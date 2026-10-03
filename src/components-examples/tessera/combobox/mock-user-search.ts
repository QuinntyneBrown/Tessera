import { ComboboxSearchFn } from '@tessera/combobox';
import { delay, of } from 'rxjs';

export interface ExampleLearner {
  id: number;
  name: string;
  team: string;
}
export const EXAMPLE_LEARNERS: ExampleLearner[] = [
  'Ada',
  'Grace',
  'Linus',
  'Morgan',
  'Sam',
  'Tamara',
  'Arun',
  'Bea',
  'Laila',
  'Kai',
  'Alex',
  'Maya',
].map((name, id) => ({ id, name, team: id % 2 ? 'Learning' : 'Platform' }));

/** In-memory example source. Unsubscription cancels its artificial delay. */
export function createMockUserSearch(pageSize = 20): ComboboxSearchFn<ExampleLearner> {
  return (query, page) => {
    const matches = EXAMPLE_LEARNERS.filter((learner) =>
      learner.name.toLowerCase().includes(query.toLowerCase()),
    );
    return of({
      items: matches.slice(page * pageSize, (page + 1) * pageSize),
      hasMore: (page + 1) * pageSize < matches.length,
      total: matches.length,
    }).pipe(delay(150));
  };
}
