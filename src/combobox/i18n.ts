import { InjectionToken } from '@angular/core';

/** Strings owned by the combobox. Placeholder values are inserted as literal text. */
export interface ComboboxStrings {
  noResults: string;
  retry: string;
  loading: string;
  resultsError: string;
  chipListLabel: string;
  removeChip: string;
  clearAll: string;
  showOptions: string;
  hideOptions: string;
  searchPrompt: string;
  loadMore: string;
  requiredError: string;
  announceResult: string;
  announceResults: string;
  announceNoResults: string;
  announceLoading: string;
  announceSelectedOne: string;
  announceSelected: string;
  announceRemoved: string;
  announceCleared: string;
  announceMaxReached: string;
  announceMoreLoadedOne: string;
  announceMoreLoaded: string;
  selectedSummary: string;
  labelSeparator: string;
}

/** Default English copy; consumers can replace any subset through COMBOBOX_I18N. */
export const DEFAULT_COMBOBOX_STRINGS: ComboboxStrings = {
  noResults: 'No results',
  retry: 'Retry',
  loading: 'Loading',
  resultsError: 'Results could not be loaded.',
  chipListLabel: 'Selected values',
  removeChip: 'Remove {label}',
  clearAll: 'Clear all selections',
  showOptions: 'Show options',
  hideOptions: 'Hide options',
  searchPrompt: 'Type at least {min} characters to search.',
  loadMore: 'Load more results',
  requiredError: 'Select at least one option.',
  announceResult: '1 result available.',
  announceResults: '{n} results available.',
  announceNoResults: 'No results found.',
  announceLoading: 'Loading results.',
  announceSelectedOne: '{label} selected. 1 selected in total.',
  announceSelected: '{label} selected. {n} selected in total.',
  announceRemoved: '{label} removed.',
  announceCleared: 'All selections cleared.',
  announceMaxReached: 'Maximum of {max} selections reached.',
  announceMoreLoadedOne: '1 more result loaded.',
  announceMoreLoaded: '{n} more results loaded.',
  selectedSummary: '{n} selected: {labels}',
  labelSeparator: ', ',
};

/** Partial per-application, route or component string overrides. */
export const COMBOBOX_I18N = new InjectionToken<Partial<ComboboxStrings>>('COMBOBOX_I18N', {
  providedIn: 'root',
  factory: () => ({}),
});

export function formatComboboxString(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}
