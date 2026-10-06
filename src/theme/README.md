# Tessera themes

`@tessera/theme` supplies immutable semantic design tokens shared by the combobox and SCORM player. Install it alongside your component packages. Components follow the system light/dark preference until you apply an explicit theme; clearing a theme restores inheritance and system defaults.

```ts
import { applyTheme, clearTheme, createTheme, darkTheme } from '@tessera/theme';

applyTheme(document.documentElement, darkTheme);
const purple = createTheme({ colorBrandForeground1: '#4c1d95' });
const container = document.getElementById('learning-area')!;
applyTheme(container, purple);
clearTheme(container);
```

Apply themes to the document root, a container, or an individual component. Descendants inherit them; nested explicit themes remain independent. `createTheme(overrides, baseTheme)` merges supported overrides into the supplied base, which defaults to `lightTheme`. It ignores unsupported keys and freezes its result. `applyTheme` replaces supported inline token values. `clearTheme` removes all supported inline token overrides, including values set directly through CSS, and preserves unrelated styles. CSS values are assigned through `style.setProperty`; theme values are trusted host configuration.

For direct CSS customization, use `--t-` followed by the semantic token name:

```css
.learning-area {
  --t-colorNeutralForeground1: #18312e;
  --t-colorNeutralBackground1: #ffffff;
  --t-spacingHorizontalL: 1.25rem;
}
```

The `Theme` interface and `tokenNames` list document supported colors, typography, spacing, radii, strokes, shadows, and motion. `tokens` contains CSS `var()` references with light fallbacks for host styles. The exported Sass module provides `defaults` and `token` for browser components: it resolves explicit tokens ahead of system defaults through private `--_t-*` properties. Those private properties are implementation details.

```scss
@use '@tessera/theme/styles/tokens' as theme;

@include theme.defaults(('colorNeutralForeground1', 'colorNeutralBackground1'));

:host {
  color: theme.token('colorNeutralForeground1');
  background: theme.token('colorNeutralBackground1');
}
```

Existing `--t-combobox-*` customization properties remain supported and take precedence over semantic tokens. Remove those overrides when you want the shared theme to control that visual decision. Popups and tooltips inherit the component's theme, including the detached overlay fallback. Changes to ancestor styles/classes and system media preferences update open detached overlays; arbitrary stylesheet replacement is reflected when the overlay is next opened.

Themes affect player-owned controls and messages. SCORM course content retains its isolated document and its own styles.

Custom palettes, fonts, spacing, and stroke widths are the host's accessibility responsibility. Retain WCAG AA text contrast (4.5:1), control/focus contrast (3:1), usable pointer targets and visible focus. Built-in themes retain Tessera's palette. Forced colors use system colors and reduced-motion preferences suppress nonessential motion. Inspect the theme playground in the dev app before adopting a custom theme.
