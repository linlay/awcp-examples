import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv';

import { AwcpActionError } from './error';
import { cloneJson, cloneJsonObject, jsonDepth, jsonUtf8Size, stableJsonStringify } from './json';
import type {
  AwcpActionRegistration,
  AwcpActionRegistrationHandle,
  AwcpActionResponse,
  AwcpError,
  AwcpFieldError,
  AwcpInvocationEvent,
  AwcpInvocationListener,
  AwcpInvokeOptions,
  AwcpManualError,
  AwcpManualIndex,
  AwcpManualRequest,
  AwcpManualSection,
  AwcpRegistry,
  AwcpRegistryOptions,
  AwcpSiteInfo,
  AwcpUnregister,
  AwcpValidateMessages,
  JsonObject,
  JsonSchema,
  JsonValue
} from './types';

export const AWCP_LIMITS = Object.freeze({
  maxActions: 128,
  maxActionLength: 128,
  maxRevisionLength: 128,
  maxRequestIdLength: 128,
  maxTitleLength: 128,
  maxDescriptionLength: 16 * 1024,
  maxSiteDescriptionLength: 16 * 1024,
  maxExamples: 32,
  maxFieldErrors: 64,
  maxFieldErrorMessages: 8,
  maxIndexBytes: 64 * 1024,
  maxSectionBytes: 256 * 1024,
  maxSchemaDepth: 20,
  maxErrorMessageLength: 4096,
  maxErrorDetailsBytes: 128 * 1024
});

export const AWCP_ACTION_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

const DEFAULT_VALIDATE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  required: '${path}：缺少必填字段。',
  type: '${path}：必须是 ${type} 类型。',
  enum: '${path}：必须是 ${allowedValues} 中的一个值。',
  const: '${path}：必须等于 ${allowedValue}。',
  minimum: '${path}：必须大于或等于 ${limit}。',
  maximum: '${path}：必须小于或等于 ${limit}。',
  exclusiveMinimum: '${path}：必须大于 ${limit}。',
  exclusiveMaximum: '${path}：必须小于 ${limit}。',
  multipleOf: '${path}：必须是 ${multipleOf} 的整数倍。',
  minLength: '${path}：长度不能少于 ${limit}。',
  maxLength: '${path}：长度不能超过 ${limit}。',
  pattern: '${path}：格式不符合要求。',
  minItems: '${path}：元素数量不能少于 ${limit}。',
  maxItems: '${path}：元素数量不能超过 ${limit}。',
  uniqueItems: '${path}：不能包含重复元素。',
  minProperties: '${path}：字段数量不能少于 ${limit}。',
  maxProperties: '${path}：字段数量不能超过 ${limit}。',
  additionalProperties: '${path}：不允许传入此字段。',
  anyOf: '${path}：不符合任何允许的参数结构。',
  oneOf: '${path}：必须且只能符合一种允许的参数结构。',
  default: '${path}：不符合 ${keyword} 约束。'
});

interface StoredContract {
  title: string;
  description: string;
  inputSchema: JsonSchema;
  examples?: JsonObject[];
}

interface ActionEntry {
  registrationToken: object;
  contract: StoredContract;
  contractFingerprint: string;
  sectionBytesWithoutRevision: number;
  schemaValidator: ValidateFunction<JsonObject>;
  validate: AwcpActionRegistration['validate'];
  invoke: AwcpActionRegistration['invoke'];
}

interface ActiveInvocation {
  requestId: string;
  action: string;
  entry: ActionEntry;
  controller: AbortController;
  finish(response: AwcpActionResponse): void;
  detachExternalSignal?: () => void;
  settled: boolean;
}

const ERRORS = Object.freeze({
  actionNotFound: 'The requested AWCP action is not registered.',
  staleRevision: 'The AWCP manual revision is stale.',
  executionFailed: 'The AWCP action execution failed.',
  cancelled: 'The AWCP action invocation was cancelled.',
  duplicateRequest: 'The AWCP request is already in flight.'
});

export function createAwcpRegistry(siteInput: AwcpSiteInfo, options: AwcpRegistryOptions = {}): AwcpRegistry {
  let site = normalizeSite(siteInput);
  const validateMessages = normalizeValidateMessages(options.validateMessages);
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false,
    verbose: true
  });
  const instanceId = createInstanceId();
  const actions = new Map<string, ActionEntry>();
  const listeners = new Set<AwcpInvocationListener>();
  const active = new Map<string, ActiveInvocation>();
  let disposed = false;
  let version = 0;
  let revision = createRevision(instanceId, version);
  let cachedIndex = buildIndex(site, revision, actions);

  const emit = (event: AwcpInvocationEvent) => {
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch {
        // Invocation lifecycle must not be controlled by observer failures.
      }
    }
  };

  const commitEntries = (next: Map<string, ActionEntry>) => {
    const nextVersion = version + 1;
    const nextRevision = createRevision(instanceId, nextVersion);
    assertSectionsFit(nextRevision, next);
    const nextIndex = buildIndex(site, nextRevision, next);
    actions.clear();
    next.forEach((entry, action) => actions.set(action, entry));
    version = nextVersion;
    revision = nextRevision;
    cachedIndex = nextIndex;
  };

  const fail = (requestId: string, action: string, error: AwcpError): AwcpActionResponse => ({
    ok: false,
    requestId,
    action,
    error
  });

  const cancelInvocation = (invocation: ActiveInvocation) => {
    if (invocation.settled) return false;
    invocation.controller.abort();
    invocation.finish(fail(invocation.requestId, invocation.action, errorOf('cancelled', ERRORS.cancelled)));
    return true;
  };

  const register = (registration: AwcpActionRegistration): AwcpActionRegistrationHandle => {
    if (disposed) throw new Error('Cannot register an action on a disposed AWCP registry.');
    const action = assertRegistrationAction(registration);
    const registrationToken = {};
    let entry = createEntry(registration, ajv, validateMessages, registrationToken);
    if (actions.has(action)) throw new Error(`AWCP action "${action}" is already registered.`);
    if (actions.size >= AWCP_LIMITS.maxActions)
      throw new RangeError(`AWCP registry cannot contain more than ${AWCP_LIMITS.maxActions} actions.`);

    const candidate = new Map(actions);
    candidate.set(action, entry);
    commitEntries(candidate);

    let registered = true;
    const update = (nextRegistration: AwcpActionRegistration) => {
      if (!registered || disposed) throw new Error('Cannot update an inactive AWCP action registration.');
      const nextAction = assertRegistrationAction(nextRegistration);
      if (nextAction !== action) throw new TypeError('AWCP action cannot change through a registration handle.');
      const nextEntry = createEntry(nextRegistration, ajv, validateMessages, registrationToken);
      if (nextEntry.contractFingerprint === entry.contractFingerprint) {
        actions.set(action, nextEntry);
        entry = nextEntry;
        return;
      }
      const next = new Map(actions);
      next.set(action, nextEntry);
      commitEntries(next);
      entry = nextEntry;
    };
    const unregister = () => {
      if (!registered) return;
      registered = false;
      if (actions.get(action) !== entry) return;
      const next = new Map(actions);
      next.delete(action);
      commitEntries(next);
      for (const invocation of [...active.values()]) {
        if (invocation.entry.registrationToken === registrationToken) cancelInvocation(invocation);
      }
    };
    return Object.freeze({ update, unregister });
  };

  const updateSite = (siteInput: AwcpSiteInfo) => {
    if (disposed) throw new Error('Cannot update a disposed AWCP registry.');
    const nextSite = normalizeSite(siteInput);
    if (stableJsonStringify(nextSite as unknown as JsonObject) === stableJsonStringify(site as unknown as JsonObject))
      return;
    const nextVersion = version + 1;
    const nextRevision = createRevision(instanceId, nextVersion);
    assertSectionsFit(nextRevision, actions);
    const nextIndex = buildIndex(nextSite, nextRevision, actions);
    site = nextSite;
    version = nextVersion;
    revision = nextRevision;
    cachedIndex = nextIndex;
  };

  const manual = (request: AwcpManualRequest = {}) => {
    if (disposed) throw new Error('Cannot read a disposed AWCP registry.');
    const normalized = normalizeManualRequest(request);
    if (normalized.section === undefined) return cloneJson(cachedIndex) as unknown as AwcpManualIndex;
    if (normalized.revision !== revision)
      return manualError('stale_revision', normalized.section, ERRORS.staleRevision);
    const entry = actions.get(normalized.section);
    if (!entry)
      return manualError('section_not_found', normalized.section, 'The requested AWCP manual section does not exist.');
    return cloneJson(buildSection(revision, normalized.section, entry.contract)) as unknown as AwcpManualSection;
  };

  const invoke = (action: string, args: unknown, options: AwcpInvokeOptions = {}): Promise<AwcpActionResponse> => {
    if (disposed) return Promise.reject(new Error('Cannot invoke an action on a disposed AWCP registry.'));
    assertAction(action);
    const safeArgs = cloneJsonObject(args);
    const requestId = options.requestId === undefined ? `awcp-${createInstanceId()}` : options.requestId;
    assertToken('requestId', requestId, AWCP_LIMITS.maxRequestIdLength);
    if (options.revision !== undefined) assertToken('revision', options.revision, AWCP_LIMITS.maxRevisionLength);
    if (options.signal !== undefined && !isAbortSignal(options.signal))
      throw new TypeError('AWCP signal must be an AbortSignal.');

    if (active.has(requestId))
      return Promise.resolve(fail(requestId, action, errorOf('duplicate_request', ERRORS.duplicateRequest)));

    return new Promise<AwcpActionResponse>((resolve) => {
      const controller = new AbortController();
      const invocation: ActiveInvocation = {
        requestId,
        action,
        entry: EMPTY_ENTRY,
        controller,
        settled: false,
        finish(response) {
          if (invocation.settled) return;
          invocation.settled = true;
          invocation.detachExternalSignal?.();
          if (active.get(requestId) === invocation) active.delete(requestId);
          if (response.ok === true) emit({ requestId, action, phase: 'succeeded', result: response.result });
          else emit({ requestId, action, phase: 'failed', error: response.error });
          resolve(response);
        }
      };

      active.set(requestId, invocation);
      emit({ requestId, action, phase: 'started' });
      if (invocation.settled) return;

      if (options.signal) {
        const onAbort = () => cancelInvocation(invocation);
        options.signal.addEventListener('abort', onAbort, { once: true });
        invocation.detachExternalSignal = () => options.signal?.removeEventListener('abort', onAbort);
        if (options.signal.aborted) {
          cancelInvocation(invocation);
          return;
        }
      }

      if (options.revision !== undefined && options.revision !== revision) {
        invocation.finish(fail(requestId, action, errorOf('stale_revision', ERRORS.staleRevision)));
        return;
      }

      const entry = actions.get(action);
      if (!entry) {
        invocation.finish(fail(requestId, action, errorOf('action_not_found', ERRORS.actionNotFound)));
        return;
      }
      invocation.entry = entry;

      if (!entry.schemaValidator(safeArgs)) {
        const fieldErrors = ajvErrorsToFieldErrors(entry.schemaValidator.errors ?? [], safeArgs, validateMessages);
        invocation.finish(fail(requestId, action, invalidArgumentsError(fieldErrors)));
        return;
      }
      if (invocation.settled || controller.signal.aborted) return;

      void Promise.resolve()
        .then(async () => {
          if (controller.signal.aborted) return undefined;
          if (entry.validate) {
            const fieldErrors = normalizeFieldErrors(await entry.validate(safeArgs, { signal: controller.signal }));
            if (controller.signal.aborted || invocation.settled) return undefined;
            if (fieldErrors.length > 0) {
              invocation.finish(fail(requestId, action, invalidArgumentsError(fieldErrors)));
              return undefined;
            }
          }
          if (controller.signal.aborted || invocation.settled) return undefined;
          return entry.invoke(safeArgs, { signal: controller.signal });
        })
        .then((result) => {
          if (invocation.settled) return;
          let safeResult: JsonValue;
          try {
            safeResult = cloneJson(result);
          } catch {
            invocation.finish(fail(requestId, action, errorOf('execution_failed', ERRORS.executionFailed)));
            return;
          }
          invocation.finish({ ok: true, requestId, action, result: safeResult });
        })
        .catch((error: unknown) => {
          if (invocation.settled) return;
          invocation.finish(fail(requestId, action, normalizeHandlerError(error)));
        });
    });
  };

  const cancel = (requestId: string) => {
    if (typeof requestId !== 'string' || !requestId || requestId.length > AWCP_LIMITS.maxRequestIdLength) return false;
    const invocation = active.get(requestId);
    return invocation ? cancelInvocation(invocation) : false;
  };

  const subscribe = (listener: AwcpInvocationListener): AwcpUnregister => {
    if (typeof listener !== 'function') throw new TypeError('AWCP listener must be a function.');
    if (disposed) return () => undefined;
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const invocation of [...active.values()]) cancelInvocation(invocation);
    active.clear();
    actions.clear();
    listeners.clear();
  };

  return Object.freeze({ register, updateSite, manual, invoke, cancel, subscribe, dispose });
}

const EMPTY_ENTRY: ActionEntry = {
  registrationToken: {},
  contract: { title: 'Internal', description: 'Internal pending invocation.', inputSchema: {} },
  contractFingerprint: '',
  sectionBytesWithoutRevision: 0,
  schemaValidator: Object.assign(() => false, {
    schema: {},
    schemaEnv: undefined,
    errors: null
  }) as unknown as ValidateFunction<JsonObject>,
  validate: undefined,
  invoke: () => null
};

function assertRegistrationAction(registration: AwcpActionRegistration): string {
  if (!registration || typeof registration !== 'object') throw new TypeError('AWCP registration must be an object.');
  assertAction(registration.action);
  return registration.action;
}

function createEntry(
  registration: AwcpActionRegistration,
  ajv: InstanceType<typeof Ajv2020>,
  validateMessages: Readonly<Record<string, string>>,
  registrationToken: object
): ActionEntry {
  assertText('title', registration.title, AWCP_LIMITS.maxTitleLength);
  assertText('description', registration.description, AWCP_LIMITS.maxDescriptionLength);
  const inputSchema = normalizeSchema(registration.inputSchema);
  let schemaValidator: ValidateFunction<JsonObject>;
  try {
    schemaValidator = ajv.compile<JsonObject>(inputSchema);
  } catch (error) {
    throw new TypeError(`AWCP inputSchema is invalid: ${error instanceof Error ? error.message : 'compile failed'}`);
  }
  const examples =
    registration.examples === undefined
      ? undefined
      : normalizeExamples(registration.examples, schemaValidator, validateMessages);
  if (registration.validate !== undefined && typeof registration.validate !== 'function')
    throw new TypeError('AWCP action validate must be a function when provided.');
  if (typeof registration.invoke !== 'function') throw new TypeError('AWCP action invoke must be a function.');
  const contract: StoredContract = {
    title: registration.title,
    description: registration.description,
    inputSchema,
    ...(examples === undefined ? {} : { examples })
  };
  return {
    registrationToken,
    contract,
    contractFingerprint: stableJsonStringify(contract as unknown as JsonObject),
    sectionBytesWithoutRevision: jsonUtf8Size(buildSection('', registration.action, contract) as unknown as JsonValue),
    schemaValidator,
    validate: registration.validate,
    invoke: registration.invoke
  };
}

function normalizeExamples(
  input: unknown,
  schemaValidator: ValidateFunction<JsonObject>,
  validateMessages: Readonly<Record<string, string>>
): JsonObject[] {
  if (!Array.isArray(input) || input.length > AWCP_LIMITS.maxExamples)
    throw new TypeError(`AWCP examples must contain at most ${AWCP_LIMITS.maxExamples} JSON objects.`);
  return input.map((example, index) => {
    const cloned = cloneJsonObject(example);
    if (!schemaValidator(cloned)) {
      const errors = ajvErrorsToFieldErrors(schemaValidator.errors ?? [], cloned, validateMessages);
      throw new TypeError(`AWCP example at index ${index} is invalid: ${summarizeFieldErrors(errors)}`);
    }
    return cloned;
  });
}

function normalizeSchema(input: unknown): JsonSchema {
  const schema = cloneJsonObject(input);
  if (jsonDepth(schema) > AWCP_LIMITS.maxSchemaDepth)
    throw new RangeError(`AWCP inputSchema depth cannot exceed ${AWCP_LIMITS.maxSchemaDepth}.`);
  validateSchemaReferences(schema);
  return schema;
}

function validateSchemaReferences(value: JsonValue): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(validateSchemaReferences);
    return;
  }
  if ('$id' in value || '$anchor' in value) throw new TypeError('AWCP inputSchema cannot contain $id or $anchor.');
  if ('$ref' in value && (typeof value.$ref !== 'string' || !value.$ref.startsWith('#/')))
    throw new TypeError('AWCP inputSchema $ref must be a local JSON Pointer.');
  Object.values(value).forEach(validateSchemaReferences);
}

function buildIndex(site: AwcpSiteInfo, revision: string, actions: Map<string, ActionEntry>): AwcpManualIndex {
  const index: AwcpManualIndex = {
    revision,
    site: { ...site },
    sections: [...actions]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([section, { contract }]) => ({ section, title: contract.title }))
  };
  if (jsonUtf8Size(index as unknown as JsonValue) > AWCP_LIMITS.maxIndexBytes)
    throw new RangeError(`AWCP manual index cannot exceed ${AWCP_LIMITS.maxIndexBytes} UTF-8 bytes.`);
  return index;
}

function buildSection(revision: string, section: string, contract: StoredContract): AwcpManualSection {
  return {
    revision,
    section,
    description: contract.description,
    inputSchema: cloneJsonObject(contract.inputSchema),
    ...(contract.examples === undefined ? {} : { examples: contract.examples.map(cloneJsonObject) })
  };
}

function assertSectionsFit(revision: string, actions: Map<string, ActionEntry>): void {
  for (const entry of actions.values()) {
    if (entry.sectionBytesWithoutRevision + revision.length > AWCP_LIMITS.maxSectionBytes)
      throw new RangeError(`AWCP manual section cannot exceed ${AWCP_LIMITS.maxSectionBytes} UTF-8 bytes.`);
  }
}

function normalizeSite(input: AwcpSiteInfo): AwcpSiteInfo {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).sort().join(',') !== 'description,name'
  )
    throw new TypeError('AWCP site must contain exactly name and description.');
  assertText('site name', input.name, AWCP_LIMITS.maxTitleLength);
  assertText('site description', input.description, AWCP_LIMITS.maxSiteDescriptionLength);
  return { name: input.name, description: input.description };
}

function normalizeManualRequest(input: unknown): { section?: string; revision?: string } {
  const request = cloneJsonObject(input);
  const keys = Object.keys(request).sort();
  if (keys.length === 0) return {};
  if (keys.join(',') !== 'revision,section')
    throw new TypeError('AWCP manual section request requires exactly revision and section.');
  assertAction(request.section);
  assertToken('revision', request.revision, AWCP_LIMITS.maxRevisionLength);
  return { section: request.section, revision: request.revision };
}

function normalizeValidateMessages(input: AwcpValidateMessages | undefined): Readonly<Record<string, string>> {
  if (input === undefined) return DEFAULT_VALIDATE_MESSAGES;
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('AWCP validateMessages must be an object.');
  const output: Record<string, string> = { ...DEFAULT_VALIDATE_MESSAGES };
  for (const [keyword, template] of Object.entries(input)) {
    if (typeof template !== 'string' || !template.trim() || template.length > AWCP_LIMITS.maxTitleLength)
      throw new TypeError('AWCP validation message template must be a non-empty bounded string.');
    output[keyword] = template;
  }
  return Object.freeze(output);
}

function ajvErrorsToFieldErrors(
  inputErrors: readonly ErrorObject[],
  args: JsonObject,
  messages: Readonly<Record<string, string>>
): AwcpFieldError[] {
  const errors = collapseBranchErrors(inputErrors);
  const grouped = new Map<string, AwcpFieldError>();
  for (const error of errors) {
    const path = errorPath(error, args);
    const key = JSON.stringify(path);
    const item = grouped.get(key) ?? { path, messages: [] };
    const message = formatValidationError(error, path, messages);
    if (!item.messages.includes(message)) item.messages.push(message);
    grouped.set(key, item);
  }
  return [...grouped.values()].slice(0, AWCP_LIMITS.maxFieldErrors);
}

function collapseBranchErrors(errors: readonly ErrorObject[]): ErrorObject[] {
  let output = [...errors];
  const terminals = errors
    .filter((error) => error.keyword === 'anyOf' || error.keyword === 'oneOf')
    .sort((left, right) => right.schemaPath.length - left.schemaPath.length);
  for (const terminal of terminals) {
    const prefix = `${terminal.schemaPath}/`;
    const branches = new Map<string, ErrorObject[]>();
    for (const error of output) {
      if (!error.schemaPath.startsWith(prefix) || !error.instancePath.startsWith(terminal.instancePath)) continue;
      const branch = error.schemaPath.slice(prefix.length).split('/', 1)[0];
      const branchErrors = branches.get(branch) ?? [];
      branchErrors.push(error);
      branches.set(branch, branchErrors);
    }
    if (branches.size === 0) continue;
    const candidates = [...branches.values()];
    candidates.sort((left, right) => branchErrorScore(left) - branchErrorScore(right));
    const selected = candidates[0];
    if (!selected) continue;
    const discarded = new Set(candidates.flat());
    output = output.filter((error) => error !== terminal && !discarded.has(error));
    output.push(...selected);
  }
  return output;
}

function branchErrorScore(errors: readonly ErrorObject[]): number {
  return errors.reduce((score, error) => {
    if (error.keyword === 'required') return score + 4;
    if (error.keyword === 'additionalProperties') return score + 3;
    if (error.keyword === 'anyOf' || error.keyword === 'oneOf') return score + 2;
    return score + 1;
  }, 0);
}

function errorPath(error: ErrorObject, args: JsonObject): Array<string | number> {
  const segments = parseJsonPointer(error.instancePath, args);
  if (error.keyword === 'required' && typeof error.params.missingProperty === 'string')
    segments.push(error.params.missingProperty);
  if (error.keyword === 'additionalProperties' && typeof error.params.additionalProperty === 'string')
    segments.push(error.params.additionalProperty);
  if (error.keyword === 'propertyNames' && typeof error.propertyName === 'string') segments.push(error.propertyName);
  return segments;
}

function parseJsonPointer(pointer: string, root: JsonValue): Array<string | number> {
  if (!pointer) return [];
  const path: Array<string | number> = [];
  let current: JsonValue | undefined = root;
  for (const encoded of pointer.slice(1).split('/')) {
    const segment = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
    const value = Array.isArray(current) && /^(0|[1-9]\d*)$/.test(segment) ? Number(segment) : segment;
    path.push(value);
    if (Array.isArray(current)) current = current[Number(segment)];
    else if (current && typeof current === 'object') current = current[segment];
    else current = undefined;
  }
  return path;
}

function formatValidationError(
  error: ErrorObject,
  path: Array<string | number>,
  messages: Readonly<Record<string, string>>
): string {
  const params = error.params as Record<string, unknown>;
  const variables: Record<string, string> = {
    path: formatFieldPath(path),
    label:
      typeof (error.parentSchema as { title?: unknown } | undefined)?.title === 'string'
        ? String((error.parentSchema as { title: string }).title)
        : formatFieldPath(path),
    keyword: error.keyword,
    type: String(params.type ?? ''),
    limit: String(params.limit ?? ''),
    multipleOf: String(params.multipleOf ?? ''),
    allowedValue: JSON.stringify(params.allowedValue),
    allowedValues: JSON.stringify(params.allowedValues ?? [])
  };
  const template = messages[error.keyword] ?? messages.default ?? DEFAULT_VALIDATE_MESSAGES.default;
  return template.replace(/\$\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, name: string) => variables[name] ?? match);
}

function formatFieldPath(path: Array<string | number>): string {
  if (path.length === 0) return '$';
  return path.reduce<string>((output, segment, index) => {
    if (typeof segment === 'number') return `${output}[${segment}]`;
    if (/^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(segment)) return `${output}${index === 0 ? '' : '.'}${segment}`;
    return `${output}[${JSON.stringify(segment)}]`;
  }, '');
}

function normalizeFieldErrors(input: unknown): AwcpFieldError[] {
  if (!Array.isArray(input) || input.length > AWCP_LIMITS.maxFieldErrors)
    throw new TypeError(`AWCP validate must return at most ${AWCP_LIMITS.maxFieldErrors} field errors.`);
  return input.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new TypeError('AWCP field error must be an object.');
    const value = item as Record<string, unknown>;
    if (
      Object.keys(value).sort().join(',') !== 'messages,path' ||
      !Array.isArray(value.path) ||
      !Array.isArray(value.messages)
    )
      throw new TypeError('AWCP field error must contain exactly path and messages arrays.');
    if (
      value.path.some(
        (segment) =>
          typeof segment !== 'string' && !(typeof segment === 'number' && Number.isInteger(segment) && segment >= 0)
      )
    )
      throw new TypeError('AWCP field error path segments must be strings or non-negative integers.');
    if (value.messages.length === 0 || value.messages.length > AWCP_LIMITS.maxFieldErrorMessages)
      throw new TypeError('AWCP field error messages must be a non-empty bounded array.');
    const normalizedMessages = value.messages.map((message) => {
      assertText('field error message', message, AWCP_LIMITS.maxTitleLength);
      return message;
    });
    return { path: [...value.path] as Array<string | number>, messages: normalizedMessages };
  });
}

function invalidArgumentsError(fieldErrors: AwcpFieldError[]): AwcpError {
  const details = cloneJson({ executionStarted: false, fieldErrors });
  if (jsonUtf8Size(details) > AWCP_LIMITS.maxErrorDetailsBytes)
    return errorOf('execution_failed', ERRORS.executionFailed);
  const message = summarizeFieldErrors(fieldErrors);
  if (!message || message.length > AWCP_LIMITS.maxErrorMessageLength)
    return errorOf('execution_failed', ERRORS.executionFailed);
  return { code: 'invalid_arguments', message, details };
}

function summarizeFieldErrors(fieldErrors: AwcpFieldError[]): string {
  return fieldErrors
    .flatMap(({ path, messages }) => {
      const field = formatFieldPath(path);
      return messages.map((message) => (message.includes(field) ? message : `${field}：${message}`));
    })
    .join('；');
}

function manualError(code: AwcpManualError['error']['code'], section: string, message: string): AwcpManualError {
  return { error: { code, section, message } };
}

function normalizeHandlerError(error: unknown): AwcpError {
  if (!(error instanceof AwcpActionError) || !/^action\..+$/.test(error.code))
    return errorOf('execution_failed', ERRORS.executionFailed);
  if (!error.message.trim() || error.message.length > AWCP_LIMITS.maxErrorMessageLength)
    return errorOf('execution_failed', ERRORS.executionFailed);
  try {
    const details = error.details === undefined ? undefined : cloneJson(error.details);
    if (details !== undefined && jsonUtf8Size(details) > AWCP_LIMITS.maxErrorDetailsBytes)
      return errorOf('execution_failed', ERRORS.executionFailed);
    return { code: error.code, message: error.message, ...(details === undefined ? {} : { details }) };
  } catch {
    return errorOf('execution_failed', ERRORS.executionFailed);
  }
}

function errorOf(code: AwcpError['code'], message: string): AwcpError {
  return { code, message };
}

function assertAction(action: unknown): asserts action is string {
  if (
    typeof action !== 'string' ||
    !action ||
    action.length > AWCP_LIMITS.maxActionLength ||
    !AWCP_ACTION_PATTERN.test(action)
  )
    throw new TypeError(
      `AWCP action must match ${AWCP_ACTION_PATTERN.toString()} and be at most ${AWCP_LIMITS.maxActionLength} characters.`
    );
}

function assertText(name: string, value: unknown, maxLength: number): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength)
    throw new TypeError(`AWCP ${name} must be a non-empty string of at most ${maxLength} characters.`);
}

function assertToken(name: string, value: unknown, maxLength: number): asserts value is string {
  if (typeof value !== 'string' || !value || value.length > maxLength)
    throw new TypeError(`AWCP ${name} must be a non-empty string of at most ${maxLength} characters.`);
}

function createRevision(instanceId: string, version: number): string {
  const value = `${instanceId}:${version}`;
  if (value.length > AWCP_LIMITS.maxRevisionLength) throw new RangeError('AWCP revision exceeds its limit.');
  return value;
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as AbortSignal).aborted === 'boolean' &&
      typeof (value as AbortSignal).addEventListener === 'function' &&
      typeof (value as AbortSignal).removeEventListener === 'function'
  );
}

function createInstanceId(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.randomUUID) throw new Error('AWCP requires crypto.randomUUID().');
  return cryptoApi.randomUUID();
}
