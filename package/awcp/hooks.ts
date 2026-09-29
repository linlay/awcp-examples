import { useContext, useEffect, useLayoutEffect, useRef, type MutableRefObject } from 'react';
import { AwcpContext } from './context';
import { cloneJsonObject, stableJsonStringify } from './json';
import type {
  AwcpActionRegistration,
  AwcpActionRegistrationHandle,
  AwcpInvocationListener,
  AwcpRegistry,
  JsonObject,
  JsonValue
} from './types';

export function useAwcpRegistry(): AwcpRegistry {
  const registry = useContext(AwcpContext);
  if (!registry) throw new Error('AwcpProvider is required.');
  return registry;
}

export function useAwcpAction(registration: AwcpActionRegistration | null): void {
  const registry = useContext(AwcpContext);
  const registrationRef = useRef(registration);
  const handleRef = useRef<AwcpActionRegistrationHandle | null>(null);
  registrationRef.current = registration;
  const descriptorKey = registration ? descriptorFingerprint(registration) : null;
  const action = registration?.action ?? null;

  useLayoutEffect(() => {
    const current = registrationRef.current;
    if (!current) return;
    if (!registry) throw new Error('AwcpProvider is required when a component enables AWCP.');
    const handle = registry.register(liveRegistration(current, registrationRef));
    handleRef.current = handle;
    return () => {
      if (handleRef.current === handle) handleRef.current = null;
      handle.unregister();
    };
  }, [registry, action]);

  useLayoutEffect(() => {
    const current = registrationRef.current;
    const handle = handleRef.current;
    if (current && handle) handle.update(liveRegistration(current, registrationRef));
  }, [registry, action, descriptorKey]);
}

export function useAwcpInvocation(listener: AwcpInvocationListener): void {
  const registry = useAwcpRegistry();
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  useEffect(() => registry.subscribe((event) => listenerRef.current(event)), [registry]);
}

function descriptorFingerprint(registration: AwcpActionRegistration): string {
  return stableJsonStringify(
    cloneJsonObject({
      action: registration.action,
      title: registration.title,
      description: registration.description,
      inputSchema: registration.inputSchema,
      ...(registration.examples === undefined ? {} : { examples: registration.examples })
    })
  );
}

function liveRegistration(
  current: AwcpActionRegistration,
  registrationRef: MutableRefObject<AwcpActionRegistration | null>
): AwcpActionRegistration {
  return {
    action: current.action,
    title: current.title,
    description: current.description,
    inputSchema: current.inputSchema,
    ...(current.examples === undefined ? {} : { examples: current.examples }),
    validate: async (args: JsonObject, context) => {
      const latest = registrationRef.current;
      return latest?.validate ? latest.validate(args, context) : [];
    },
    invoke(args, context): JsonValue | Promise<JsonValue> {
      const latest = registrationRef.current;
      if (!latest) throw new Error('AWCP action registration is unavailable.');
      return latest.invoke(args, context);
    }
  };
}
