export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = { [key: string]: JsonValue };
export type JsonSchema = JsonObject;

export interface AwcpSiteInfo {
  name: string;
  /** Plain-text page guide: purpose, regions, operation flow and page-level limits. */
  description: string;
}

export interface AwcpManualSectionSummary {
  section: string;
  title: string;
}

export interface AwcpManualIndex {
  revision: string;
  site: AwcpSiteInfo;
  sections: AwcpManualSectionSummary[];
}

export interface AwcpManualSection {
  revision: string;
  section: string;
  description: string;
  inputSchema: JsonSchema;
  examples?: JsonObject[];
}

export type AwcpManualErrorCode = 'section_not_found' | 'stale_revision';

export interface AwcpManualError {
  error: { code: AwcpManualErrorCode; section: string; message: string };
}

export interface AwcpManualSectionRequest {
  section: string;
  revision: string;
}

export type AwcpManualRequest = Record<string, never> | AwcpManualSectionRequest;

export type AwcpFieldPath = Array<string | number>;

export interface AwcpFieldError {
  path: AwcpFieldPath;
  messages: string[];
}

export interface AwcpValidationContext {
  signal: AbortSignal;
}

export interface AwcpInvocationContext {
  signal: AbortSignal;
}

export interface AwcpActionRegistration<Input extends JsonObject = JsonObject, Output extends JsonValue = JsonValue> {
  action: string;
  title: string;
  /** Plain-text method guide: purpose, prerequisites, parameter semantics, effects, result and failure handling. */
  description: string;
  inputSchema: JsonSchema;
  examples?: JsonObject[];
  validate?(args: Input, context: AwcpValidationContext): AwcpFieldError[] | Promise<AwcpFieldError[]>;
  invoke(args: Input, context: AwcpInvocationContext): Output | Promise<Output>;
}

export interface AwcpActionRegistrationHandle {
  update(registration: AwcpActionRegistration): void;
  unregister(): void;
}

export type AwcpErrorCode =
  | 'action_not_found'
  | 'stale_revision'
  | 'invalid_arguments'
  | 'execution_failed'
  | 'cancelled'
  | 'duplicate_request'
  | `action.${string}`;

export interface AwcpError {
  code: AwcpErrorCode;
  message: string;
  details?: JsonValue;
}

export type AwcpActionResponse =
  | {
      ok: true;
      requestId: string;
      action: string;
      result: JsonValue;
    }
  | {
      ok: false;
      requestId: string;
      action: string;
      error: AwcpError;
    };

interface AwcpInvocationEventBase {
  requestId: string;
  action: string;
}

export type AwcpInvocationEvent =
  | (AwcpInvocationEventBase & { phase: 'started' })
  | (AwcpInvocationEventBase & { phase: 'succeeded'; result: JsonValue })
  | (AwcpInvocationEventBase & { phase: 'failed'; error: AwcpError });

export type AwcpInvocationListener = (event: AwcpInvocationEvent) => void;
export type AwcpUnregister = () => void;

export interface AwcpInvokeOptions {
  requestId?: string;
  revision?: string;
  signal?: AbortSignal;
}

export interface AwcpBrowserInvokeRequest {
  requestId: string;
  revision: string;
  action: string;
  args: JsonObject;
}

export type AwcpValidateMessages = Partial<Record<string, string>>;

export interface AwcpRegistryOptions {
  validateMessages?: AwcpValidateMessages;
}

export interface AwcpBrowserApi {
  readonly protocolVersion: 1;
  manual(request?: AwcpManualRequest): AwcpManualIndex | AwcpManualSection | AwcpManualError;
  invoke(request: AwcpBrowserInvokeRequest): Promise<AwcpActionResponse>;
  cancel(requestId: string): boolean;
}

export interface AwcpRegistry {
  register(registration: AwcpActionRegistration): AwcpActionRegistrationHandle;
  updateSite(site: AwcpSiteInfo): void;
  manual(request?: AwcpManualRequest): AwcpManualIndex | AwcpManualSection | AwcpManualError;
  invoke(action: string, args: unknown, options?: AwcpInvokeOptions): Promise<AwcpActionResponse>;
  cancel(requestId: string): boolean;
  subscribe(listener: AwcpInvocationListener): AwcpUnregister;
  dispose(): void;
}
