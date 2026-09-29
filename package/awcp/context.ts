import { createContext } from 'react';
import type { AwcpRegistry } from './types';

export const AwcpContext = createContext<AwcpRegistry | null>(null);
