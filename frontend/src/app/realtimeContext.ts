import { createContext, useContext } from 'react';
import type { RealtimeService } from '../pc/service/realtimeService';

export const RealtimeContext = createContext<RealtimeService | null>(null);
export const useRealtime = () => useContext(RealtimeContext);
