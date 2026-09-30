import { AwcpProvider } from '@app/awcp';
import type { PropsWithChildren, ReactElement } from 'react';
import type { AwcpSiteInfo } from '@app/awcp';

interface AppProvidersProps extends PropsWithChildren {
  site: AwcpSiteInfo;
  scopeKey: string;
}

export function AppProviders({ children, site, scopeKey }: AppProvidersProps): ReactElement {
  return (
    <AwcpProvider site={site} scopeKey={scopeKey} exposeToWindow>
      {children}
    </AwcpProvider>
  );
}
