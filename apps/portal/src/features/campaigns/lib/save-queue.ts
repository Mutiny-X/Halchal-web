export type SaveQueueStatus = {
  /** Saves queued or running right now. */
  pending: number;
  /** The last save's failure, cleared by the next successful save. */
  error: unknown | null;
};

/**
 * Runs campaign saves strictly one after another, in the order they were
 * requested. Each save reads the wizard's latest state when it actually
 * starts, so:
 *  - two saves can never both see "no campaign yet" and each create one
 *    (the second waits, then finds the first one's id and updates instead);
 *  - an older, slower request can never land after a newer one and put
 *    stale values back on the server.
 * A failed save doesn't block the ones queued behind it.
 */
export class SaveQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private lastError: unknown | null = null;

  constructor(private readonly onChange: (status: SaveQueueStatus) => void = () => {}) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    this.pending += 1;
    this.emit();
    const result = this.tail.then(task);
    // The chain continues whether this task succeeds or fails.
    this.tail = result.catch(() => undefined);
    return result.then(
      (value) => {
        this.pending -= 1;
        this.lastError = null;
        this.emit();
        return value;
      },
      (error: unknown) => {
        this.pending -= 1;
        this.lastError = error;
        this.emit();
        throw error;
      },
    );
  }

  /** Resolves once everything queued so far has finished (success or not). */
  idle(): Promise<void> {
    return this.tail.then(() => undefined);
  }

  get status(): SaveQueueStatus {
    return { pending: this.pending, error: this.lastError };
  }

  private emit(): void {
    this.onChange(this.status);
  }
}
