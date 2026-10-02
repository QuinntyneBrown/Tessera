## Project Overview

Tessera is a component library project. Its repository layout, tooling, and conventions shall be structured identically to [angular/components](https://github.com/angular/components), with two exceptions: Bazel is not used (builds use the Angular CLI and ng-packagr via `angular.json` and `ng-package.json` instead), and server-side rendering is not supported (no `universal-app`; components may assume a browser environment).

The library shall start with a single component: a player that can play SCORM files, intended for use in a Learning Management System (LMS).

## Accessibility

Accessibility is a priority. Every component shall be fully functional with all major screen readers (JAWS, NVDA, VoiceOver, TalkBack, and Narrator) and fully operable by keyboard alone. Conform to WCAG 2.2 AA at minimum, follow the WAI-ARIA Authoring Practices, and ship an accessibility test (automated plus manual screen reader verification) with every component change.

Every component shall be fully responsive and functional at every viewport width from extra-small (320 CSS px) to extra-large, at up to 400% browser zoom, with text enlarged to 200%, and with WCAG text-spacing overrides applied, without horizontal scrolling or loss of content or functionality.

## Incremental Implementation and ATDD - mandatory

Every production feature implementation MUST follow
[Addy Osmani's incremental approach](https://addyosmani.com/blog/ai-coding-workflow/)
combined with acceptance test-driven development (ATDD). No exceptions. Plan small,
reviewable slices, then complete one slice at a time: write Given-When-Then
acceptance criteria, write the acceptance test, and run it to prove it fails for
the expected reason BEFORE writing production code. Implement only what satisfies
that slice, refactor with tests green, and run the relevant regression checks.
Do not move to the next slice until those checks pass. No bulk implementation,
no tests added afterward, and no weakening tests to manufacture a pass. Keep
criteria, tests, and implementation aligned until the entire feature is complete.

Front end: Playwright, using the Page Object Model - one page object per screen,
owning the selectors and the interactions. Tests state intent; page objects know
the DOM. Never put a selector in a test.

Run frontend tests in Chromium only. Do not configure or run Firefox, WebKit,
or any other browser for frontend testing.

### Never write architecture tests

Never add a test that asserts the shape of the codebase rather than its behavior:
no structure, layout, or naming tests; no banned-API scans; no traceability tests
that parse the specifications. Those constraints belong to the compiler, the
formatter, and review. A test suite exists to prove behavior.

### Mocks are design artifacts

Mocks (UI mockups and prototypes) are design artifacts, not production features.
ATDD does not apply to them, and no tests are to be written for them. Tests and
ATDD begin only when a mock is turned into a production implementation.

## Architecture and Design

- Implement requirements radically simply: the least code that satisfies the
  acceptance criteria, and nothing more. Simple in design, never reduced in scope.

## Target Folder Structure

The layout below mirrors angular/components, scoped down to what Tessera needs today. The SCORM player is a standalone secondary-entry-point-free package under `src/`, in the same way `youtube-player` and `google-maps` are in angular/components. Folders that exist upstream but have no Tessera equivalent yet (e.g. `cdk`, `material`, `aria`) are intentionally omitted and will be added only when needed.

```
Tessera/
├── .github/                      # CI workflows, issue/PR templates, copilot-instructions.md
├── .husky/                       # Git hooks
├── .ng-dev/                      # ng-dev config (commit message, format, release)
├── .vscode/                      # Shared editor settings and recommended extensions
├── docs/                         # Contributor and project documentation
│   ├── specs/                    # L1/L2 requirements
│   └── detailed-designs/         # Software design documents
├── goldens/                      # Public API goldens (api-extractor reports)
│   └── scorm-player/
├── scripts/                      # Repo maintenance and release scripts
├── test/                         # Shared test configuration and helpers
├── tools/                        # Build, packaging, lint, and release tooling
│   ├── public_api_guard/
│   └── package-docs-compile/
├── src/
│   ├── scorm-player/             # The SCORM player library package (@tessera/scorm-player)
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── ng-package.json
│   │   ├── index.ts
│   │   ├── public-api.ts
│   │   ├── scorm-player.ts           # Component class
│   │   ├── scorm-player.html         # Component template
│   │   ├── scorm-player.scss         # Component styles
│   │   ├── scorm-player.spec.ts      # Component unit tests
│   │   ├── scorm-player-module.ts    # NgModule (if used)
│   │   ├── runtime/                  # SCORM runtime API (1.2 and 2004 adapters, data model)
│   │   ├── package/                  # Manifest (imsmanifest.xml) parsing and package loading
│   │   └── testing/                  # Component harness for consumers' tests
│   ├── components-examples/      # Example usages, consumed by docs and tests
│   │   └── tessera/scorm-player/
│   ├── dev-app/                  # Local development playground
│   └── e2e-app/                  # App used by end-to-end tests
├── AGENTS.md
├── CLAUDE.md                     # Points to AGENTS.md
├── GEMINI.md                     # Points to AGENTS.md
├── angular.json
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── LICENSE
└── README.md
```