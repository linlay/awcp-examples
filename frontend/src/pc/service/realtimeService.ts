import type { WorkspaceEvent } from '@app/api';

export type SyncMode = 'off' | 'notify' | 'auto';
type Observer = {
  resources: readonly string[];
  revision: number;
  refresh(): Promise<number>;
  dirty?(): boolean;
  running?: boolean;
  failed?: boolean;
};
export interface SyncState {
  mode: SyncMode;
  connected: boolean;
  pending: number;
  busy: boolean;
  error: boolean;
}

/** Query-level acknowledgements: updating one query never marks another query
 * with the same resource as fresh. Events are invalidations, never UI commands. */
export class RealtimeService {
  private listeners = new Set<() => void>();
  private observers = new Map<string, Observer>();
  private revisions = new Map<string, number>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private visible = true;
  private paused = false;
  private state: SyncState;
  constructor(mode: SyncMode = 'notify') {
    this.state = { mode, connected: false, pending: 0, busy: false, error: false };
  }
  snapshot = (): SyncState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private target(observer: Observer): number {
    return Math.max(0, ...observer.resources.map((resource) => this.revisions.get(resource) ?? 0));
  }
  private publish(): void {
    const observers = [...this.observers.values()];
    this.state = {
      ...this.state,
      pending: observers.filter((o) => this.target(o) > o.revision).length,
      busy: observers.some((o) => o.running),
      error: observers.some((o) => o.failed)
    };
    for (const listener of this.listeners) listener();
  }
  setMode(mode: SyncMode): void {
    this.state = { ...this.state, mode };
    this.publish();
    this.schedule();
  }
  setConnected(connected: boolean): void {
    this.state = { ...this.state, connected };
    this.publish();
  }
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.schedule();
  }
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.schedule();
  }
  observe(id: string, observer: Observer): () => void {
    this.observers.set(id, observer);
    this.publish();
    this.schedule();
    return () => {
      this.observers.delete(id);
      this.publish();
    };
  }
  acknowledge(id: string, revision: number): void {
    const observer = this.observers.get(id);
    if (observer) {
      observer.revision = Math.max(observer.revision, revision);
      observer.failed = false;
      this.publish();
    }
  }
  receive(event: WorkspaceEvent): void {
    for (const resource of event.resources)
      this.revisions.set(resource, Math.max(event.revision, this.revisions.get(resource) ?? 0));
    this.publish();
    this.schedule();
  }
  private schedule(): void {
    if (this.timer || this.state.mode !== 'auto' || !this.visible || this.paused) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.refresh(false);
    }, 300);
  }
  async refresh(manual = true): Promise<void> {
    if (this.paused || (!manual && (this.state.mode !== 'auto' || !this.visible))) return;
    await Promise.all(
      [...this.observers.entries()].map(async ([id, observer]) => {
        if (
          observer.running ||
          (!manual && observer.failed) ||
          observer.dirty?.() ||
          this.target(observer) <= observer.revision
        )
          return;
        observer.running = true;
        observer.failed = false;
        this.publish();
        try {
          // A request already in flight may have read an older snapshot. After
          // sharing its response, perform at most one catch-up query.
          for (let attempt = 0; attempt < 2; attempt++) {
            const revision = await observer.refresh();
            if (this.observers.get(id) !== observer) return;
            observer.revision = Math.max(observer.revision, revision);
            if (
              observer.revision >= this.target(observer) ||
              observer.dirty?.() ||
              this.paused ||
              (!manual && (!this.visible || this.state.mode !== 'auto'))
            )
              break;
          }
          // Bound retries if updates keep arriving or the server cannot catch up.
          if (observer.revision < this.target(observer)) observer.failed = true;
        } catch {
          if (this.observers.get(id) === observer) observer.failed = true;
        } finally {
          observer.running = false;
          this.publish();
        }
      })
    );
  }
  reset(): void {
    this.revisions.clear();
    this.observers.clear();
    this.publish();
  }
  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
