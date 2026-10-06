import values from './theme-values.json';

/** The supported semantic design decisions. Values are CSS strings. */
export type { Theme } from './theme-types';
import type { Theme } from './theme-types';
export type PartialTheme = Partial<Theme>;

export const lightTheme: Theme = Object.freeze(values.light);
export const darkTheme: Theme = Object.freeze(values.dark);
export const tokenNames: readonly (keyof Theme)[] = Object.freeze(
  Object.keys(lightTheme) as (keyof Theme)[],
);

/** CSS references inherit from ancestors, with a light fallback outside Tessera components. */
export const tokens: Readonly<Record<keyof Theme, string>> = Object.freeze(
  Object.fromEntries(
    tokenNames.map((name) => [name, `var(--t-${name}, ${lightTheme[name]})`]),
  ) as Record<keyof Theme, string>,
);

/** Merge supported overrides without modifying either input. */
export function createTheme(overrides: PartialTheme, baseTheme: Theme = lightTheme): Theme {
  return Object.freeze(
    Object.fromEntries(
      tokenNames.map((name) => [name, overrides[name] ?? baseTheme[name]]),
    ) as Record<keyof Theme, string>,
  );
}

/** Apply to the document root, a container, or a component host. */
export function applyTheme(element: HTMLElement, theme: Theme): void {
  for (const name of tokenNames) element.style.setProperty(`--t-${name}`, theme[name]);
}

/** Remove supported inline overrides so inherited or system defaults apply again. */
export function clearTheme(element: HTMLElement): void {
  for (const name of tokenNames) element.style.removeProperty(`--t-${name}`);
}
