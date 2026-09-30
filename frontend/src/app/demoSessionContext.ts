import { createContext } from 'react';
import type { DemoApi, DemoSession } from '@app/api';

export interface DemoSessionContextValue {
  session: DemoSession;
  api: DemoApi;
  reset(): Promise<void>;
  refresh(): Promise<void>;
}
export const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);
