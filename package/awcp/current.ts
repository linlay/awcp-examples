import type {
  AwcpActionResponse,
  AwcpInvokeOptions,
  AwcpManualIndex,
  AwcpManualRequest,
  AwcpManualSection,
  AwcpManualError,
  AwcpRegistry,
  AwcpUnregister
} from './types';

interface AwcpRegistryBinding {
  registry: AwcpRegistry;
}

const registryBindings: AwcpRegistryBinding[] = [];

export function getCurrentAwcpRegistry(): AwcpRegistry | null {
  return registryBindings[registryBindings.length - 1]?.registry ?? null;
}

export function getCurrentAwcpManual(
  request?: AwcpManualRequest
): AwcpManualIndex | AwcpManualSection | AwcpManualError | null {
  return getCurrentAwcpRegistry()?.manual(request) ?? null;
}

export function invokeCurrentAwcpAction(
  action: string,
  args: unknown,
  options?: AwcpInvokeOptions
): Promise<AwcpActionResponse> {
  const registry = getCurrentAwcpRegistry();
  if (!registry) return Promise.reject(new Error('No current AWCP registry is available.'));
  return registry.invoke(action, args, options);
}

export function bindCurrentAwcpRegistry(registry: AwcpRegistry): AwcpUnregister {
  const binding: AwcpRegistryBinding = { registry };
  registryBindings.push(binding);

  let bound = true;
  return () => {
    if (!bound) return;
    bound = false;
    const index = registryBindings.indexOf(binding);
    if (index >= 0) registryBindings.splice(index, 1);
  };
}
