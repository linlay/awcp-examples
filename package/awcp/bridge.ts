import { getCurrentAwcpRegistry } from './current';
import { cloneJsonObject } from './json';
import type { AwcpBrowserApi, AwcpBrowserInvokeRequest, AwcpManualRequest, AwcpUnregister } from './types';

declare global {
  interface Window {
    awcp?: AwcpBrowserApi;
  }
}

export function exposeCurrentAwcpRegistryToWindow(): AwcpUnregister {
  if (typeof window === 'undefined') return () => undefined;
  const previous = window.awcp;
  const api: AwcpBrowserApi = Object.freeze({
    protocolVersion: 1 as const,
    manual(request?: AwcpManualRequest) {
      const envelope = assertManualRequest(request);
      const registry = getCurrentAwcpRegistry();
      if (!registry) throw new Error('No current AWCP registry is available.');
      return registry.manual(envelope);
    },
    invoke(request: AwcpBrowserInvokeRequest) {
      try {
        const envelope = assertInvokeRequest(request);
        const registry = getCurrentAwcpRegistry();
        if (!registry) return Promise.reject(new Error('No current AWCP registry is available.'));
        return registry.invoke(envelope.action, envelope.args, {
          requestId: envelope.requestId,
          revision: envelope.revision
        });
      } catch (error) {
        return Promise.reject(error);
      }
    },
    cancel(requestId: string) {
      return getCurrentAwcpRegistry()?.cancel(requestId) ?? false;
    }
  });
  window.awcp = api;

  let exposed = true;
  return () => {
    if (!exposed) return;
    exposed = false;
    if (window.awcp !== api) return;
    if (previous) window.awcp = previous;
    else delete window.awcp;
  };
}

function assertManualRequest(request: unknown): AwcpManualRequest {
  const envelope = cloneJsonObject(request ?? {});
  const keys = Object.keys(envelope);
  if (keys.length === 0) return {};
  if (
    keys.sort().join(',') !== 'revision,section' ||
    typeof envelope.section !== 'string' ||
    typeof envelope.revision !== 'string'
  )
    throw new TypeError('AWCP manual section request requires exactly section and revision.');
  return { section: envelope.section, revision: envelope.revision };
}

function assertInvokeRequest(request: unknown): AwcpBrowserInvokeRequest {
  const envelope = cloneJsonObject(request);
  const keys = Object.keys(envelope).sort();
  if (keys.join(',') !== 'action,args,requestId,revision')
    throw new TypeError('AWCP invoke requires exactly requestId, revision, action and args.');
  if (
    typeof envelope.requestId !== 'string' ||
    typeof envelope.revision !== 'string' ||
    typeof envelope.action !== 'string' ||
    envelope.args === null ||
    typeof envelope.args !== 'object' ||
    Array.isArray(envelope.args)
  )
    throw new TypeError('AWCP invoke envelope is invalid.');
  return envelope as unknown as AwcpBrowserInvokeRequest;
}
