type PendingBatch<T> = {
  items: T[];
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Agrupa ráfagas por conversación. Cada mensaje nuevo reinicia la espera y el
 * handler recibe una única tanda cuando el cliente deja de escribir.
 */
export class MessageBatcher<T> {
  private batches = new Map<string, PendingBatch<T>>();

  constructor(
    private readonly waitMs: number,
    private readonly flush: (key: string, items: T[]) => Promise<void>,
  ) {}

  push(key: string, item: T): void {
    const pending = this.batches.get(key);
    if (pending) {
      clearTimeout(pending.timer);
      pending.items.push(item);
    }

    const items = pending?.items || [item];
    const timer = setTimeout(() => {
      this.batches.delete(key);
      this.flush(key, items).catch((error) => {
        console.error(`[BOT] Error procesando tanda de ${key}:`, error);
      });
    }, this.waitMs);
    this.batches.set(key, { items, timer });
  }
}
