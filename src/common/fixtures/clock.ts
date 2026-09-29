export const DEFAULT_DEMO_TIME = '2026-09-19T09:00:00+08:00';

export class DemoClock {
  private readonly initialTime: number;
  private time: number;

  constructor(startAt = DEFAULT_DEMO_TIME) {
    const parsed = Date.parse(startAt);
    if (!Number.isFinite(parsed)) throw new Error('Invalid demo clock start time.');
    this.initialTime = parsed;
    this.time = parsed;
  }

  now(): string {
    return new Date(this.time).toISOString();
  }

  advanceBy(milliseconds: number): void {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
      throw new Error('Demo clock advance must be a non-negative integer.');
    }
    this.time += milliseconds;
  }

  reset(): void {
    this.time = this.initialTime;
  }
}
