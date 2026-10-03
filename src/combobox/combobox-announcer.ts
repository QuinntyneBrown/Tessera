import { DestroyRef, signal } from '@angular/core';

/** One instance's announcement queue. Search messages coalesce; selection messages preserve order. */
export class ComboboxAnnouncer {
  readonly message = signal('');
  readonly priority = signal<'polite' | 'assertive'>('polite');
  private searchMessage: string | undefined;
  private selections: string[] = [];
  private quietTimer: ReturnType<typeof setTimeout> | undefined;
  private writeTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingWrite:
    { search?: string; selections: string[]; priority: 'polite' | 'assertive' } | undefined;

  constructor(destroyRef: DestroyRef) {
    destroyRef.onDestroy(() => {
      clearTimeout(this.quietTimer);
      clearTimeout(this.writeTimer);
    });
  }

  search(text: string): void {
    this.searchMessage = text;
    this.schedule();
  }

  selection(text: string): void {
    this.selections.push(text);
    this.schedule();
  }

  cancelSearch(): void {
    this.searchMessage = undefined;
    if (!this.selections.length) clearTimeout(this.quietTimer);
    if (this.pendingWrite) {
      this.pendingWrite.search = undefined;
      if (!this.pendingWrite.selections.length) {
        clearTimeout(this.writeTimer);
        this.pendingWrite = undefined;
      }
    }
  }

  failure(text: string): void {
    this.cancelSearch();
    if (this.pendingWrite?.selections.length) {
      this.selections.unshift(...this.pendingWrite.selections);
      this.schedule();
    }
    this.write({ search: text, selections: [], priority: 'assertive' });
  }

  private schedule(): void {
    clearTimeout(this.quietTimer);
    this.quietTimer = setTimeout(() => {
      const pending = {
        search: this.searchMessage,
        selections: this.selections,
        priority: 'polite' as const,
      };
      this.searchMessage = undefined;
      this.selections = [];
      if (pending.search || pending.selections.length) this.write(pending);
    }, 150);
  }

  private write(pending: {
    search?: string;
    selections: string[];
    priority: 'polite' | 'assertive';
  }): void {
    clearTimeout(this.writeTimer);
    this.pendingWrite = pending;
    this.priority.set(pending.priority);
    this.message.set('');
    // Let the priority and empty region render before inserting even a repeated message.
    this.writeTimer = setTimeout(() => {
      if (this.pendingWrite === pending) {
        this.pendingWrite = undefined;
        this.message.set(
          [...(pending.search ? [pending.search] : []), ...pending.selections].join(' '),
        );
      }
    }, 32);
  }
}
