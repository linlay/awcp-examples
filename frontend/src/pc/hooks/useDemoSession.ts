import { useContext } from 'react';
import { DemoSessionContext } from '../../app/demoSessionContext';

export function useDemoSession() {
  return useContext(DemoSessionContext);
}
