import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';

import { exposeCurrentAwcpRegistryToWindow } from './bridge';
import { AwcpContext } from './context';
import { bindCurrentAwcpRegistry } from './current';
import { cloneJsonObject, stableJsonStringify } from './json';
import { createAwcpRegistry } from './registry';
import type { AwcpInvocationListener, AwcpRegistry, AwcpSiteInfo, AwcpValidateMessages } from './types';

export interface AwcpProviderProps {
  children: ReactNode;
  site: AwcpSiteInfo;
  exposeToWindow?: boolean;
  onInvocation?: AwcpInvocationListener;
  validateMessages?: AwcpValidateMessages;
  /** Rotates the Registry when the page scope changes without remounting the child tree. */
  scopeKey?: string;
}

export function AwcpProvider({
  children,
  site,
  exposeToWindow = false,
  onInvocation,
  validateMessages,
  scopeKey
}: AwcpProviderProps) {
  const listenerRef = useRef(onInvocation);
  const pendingDisposalsRef = useRef(new WeakSet<AwcpRegistry>());
  const validateMessagesKey = stableJsonStringify(cloneJsonObject(validateMessages ?? {}));
  const siteName = site.name;
  const siteDescription = site.description;
  const messages = useMemo(() => JSON.parse(validateMessagesKey) as AwcpValidateMessages, [validateMessagesKey]);
  const registry = useMemo(
    () => {
      // A changed page scope must create a fresh Registry even when the site text is unchanged.
      void scopeKey;
      return createAwcpRegistry({ name: siteName, description: siteDescription }, { validateMessages: messages });
    },
    [scopeKey, siteName, siteDescription, messages]
  );
  listenerRef.current = onInvocation;

  useLayoutEffect(
    () => registry.updateSite({ name: siteName, description: siteDescription }),
    [registry, siteName, siteDescription]
  );

  useLayoutEffect(() => {
    const unbind = bindCurrentAwcpRegistry(registry);
    return unbind;
  }, [registry]);

  useLayoutEffect(() => {
    if (!exposeToWindow) return;
    return exposeCurrentAwcpRegistryToWindow();
  }, [exposeToWindow]);

  useEffect(() => {
    const pendingDisposals = pendingDisposalsRef.current;
    pendingDisposals.delete(registry);
    const unsubscribe = registry.subscribe((event) => listenerRef.current?.(event));
    return () => {
      unsubscribe();
      pendingDisposals.add(registry);
      queueMicrotask(() => {
        if (pendingDisposals.delete(registry)) registry.dispose();
      });
    };
  }, [registry]);

  return <AwcpContext.Provider value={registry}>{children}</AwcpContext.Provider>;
}
