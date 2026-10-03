import type { WorkspaceEvent } from './types';

export function observeWorkspace(
  cursor: string,
  callbacks: { change(event: WorkspaceEvent): void; status(connected: boolean): void; invalid(): void }
): () => void {
  const source = new EventSource(`/api/v1/events?after=${encodeURIComponent(cursor)}`);
  source.addEventListener('ready', () => callbacks.status(true));
  source.onerror = () => {
    callbacks.status(false);
    // Network errors reconnect natively. Terminal failures (for example an
    // expired cookie rejected with 401) need a fresh session before reconnecting.
    if (source.readyState === 2) callbacks.invalid();
  };
  source.addEventListener('session.invalid', () => {
    source.close();
    callbacks.status(false);
    callbacks.invalid();
  });
  source.addEventListener('change', (message) => {
    try {
      const event: unknown = JSON.parse((message as MessageEvent<string>).data);
      if (!event || typeof event !== 'object') return;
      const value = event as Partial<WorkspaceEvent>;
      if (
        typeof value.id !== 'string' ||
        typeof value.workspaceId !== 'string' ||
        typeof value.generation !== 'string' ||
        typeof value.type !== 'string' ||
        typeof value.source !== 'string' ||
        !Number.isSafeInteger(value.revision) ||
        (value.revision ?? -1) < 0 ||
        !Array.isArray(value.resources) ||
        !value.resources.every((resource) => typeof resource === 'string')
      )
        return;
      callbacks.change(value as WorkspaceEvent);
    } catch {
      callbacks.status(false);
    }
  });
  return () => source.close();
}
