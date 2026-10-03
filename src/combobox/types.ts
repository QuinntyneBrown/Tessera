import { Observable } from 'rxjs';

/** A page supplied by the application, numbered from zero. */
export interface ComboboxPage<T> {
  items: T[];
  hasMore: boolean;
  total?: number;
}

/** Application-owned asynchronous data source. */
export type ComboboxSearchFn<T> = (query: string, page: number) => Observable<ComboboxPage<T>>;

/** One user selection operation and its resulting value. */
export interface ComboboxSelectionChange<T> {
  added?: T;
  removed?: T;
  value: T[];
}
