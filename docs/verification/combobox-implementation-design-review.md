# Combobox implementation and design review

The [combobox detailed designs](../detailed-designs/combobox/) match the reviewed browser implementation. Five consecutive review iterations completed without findings on 2026-10-03 after the corrections described below.

## Scope and corrections

The review covers `L1-009`–`L1-018`, `L2-022`–`L2-050`, the subsystem overview, all ten feature documents, and their 60 PlantUML sources and rendered images. Implementation references include the component, collaborators, stylesheet, template, public API, harness, examples, acceptance fixture, page object, and existing acceptance tests. The reviewed working tree is based on commit `4f4ea1c34302c480d86d8258285db1cd875c77b9`, including its local implementation changes.

The designs now describe component-owned search, selection, forms, keyboard handling, and overlay geometry. Obsolete helper classes were removed from the diagrams. The corrected contracts include immediate request invalidation before debounce, guarded paging and Retry, control replacement and deferred form updates, generated identifiers, template-owned live-region DOM, announcement queue timings, tooltip dismissal, fallback dialog placement, and resource disposal.

The public API, localisation keys, typed slots, harness timing, example source, presentation tokens, and performance sampling now follow the implementation. Customer-facing prose describes product behavior and consumer responsibilities. Observed automated results and pending manual release checks remain separate from the design contract.

An earlier sequence reached four clean iterations before a presentation diagram was found to list an unused reduced-motion media query. That diagram was corrected and rendered again; the final sequence below started afterward.

## Consecutive clean iterations

Each iteration reconsidered the complete implementation/design contract and cross-feature consistency, with the additional focus listed below. Common document checks covered exact requirement quotations and parents, local references, document structure and voice, and all source/image pairs. Fingerprints confirmed that neither the reviewed implementation references nor the design artifacts changed during this sequence. Repeated checks of unchanged artifacts reused the completed behavioral test and render evidence.

| Iteration | Completed (UTC) | Additional review focus | Result |
|-----------|-----------------|-------------------------|--------|
| 1 | 15:21:35 | Query commitment and invalidation, paging and Retry guards, selection, forms, popup lifecycle, corrected presentation view | Clean |
| 2 | 15:22:01 | ARIA relationships and announcements, input and chip keyboard handling, RTL, tooltip-first dismissal, touch boundaries | Clean |
| 3 | 15:22:37 | Public exports and defaults, API golden, localisation and slots, harness timing, examples, page-object accessibility checks | Clean |
| 4 | 15:23:14 | Palette and media queries, reflow and targets, secure text rendering, teardown, performance evidence, manual release conditions | Clean |
| 5 | 15:24:25 | Customer prose and complete cross-feature reconciliation of requirements, ownership, class/C4/sequence views, release claims, and rendered figures | Clean |

Design artifact SHA-256: `37836b0531f1132aa388bbb153bda18946da2e6c62e32669edef9982c34098a5`.

Implementation/reference SHA-256: `8d491748af30ba1ce8eb7a687de2dc53fbcaee69f59d4e1a0628205a0399a09c`.

The design fingerprint covers every file under `docs/detailed-designs/combobox/`, plus the detailed-design index and implementation-status document. The reference fingerprint covers 60 files: the combobox package, combobox examples, dev/e2e application sources, combobox API golden, package-doc compilation tool, combobox acceptance files and page object, and root package/Angular/Playwright configuration. Generated and ignored files are excluded from the reference inventory. Both hashes use sorted paths, each repository-relative UTF-8 path followed by a NUL byte and its raw file bytes. This review record is outside both fingerprints.

## Verification evidence

- Chromium regression command: `pnpm exec playwright test --grep-invert 'render-latency samples' combobox --workers=2` — **113 passed**. The configured suite excludes the separate packed-consumer test; isolated latency samples were not rerun in this documentation review.
- All 60 PlantUML diagrams rendered with zero failures and passed strict syntax checking. All images received visual overview inspection; revised views received additional inspection, including the final presentation container image.
- Document validation found 29 requirement IDs with exact quotations and L1 parents, 119 valid local references, and 60 valid source/PNG pairs.
- Prettier and the scoped Git whitespace check passed. This review changes documentation and diagrams; production code and tests were not edited.

The earlier [mock and specification review](combobox-design-review.md) remains a historical artifact review. This record additionally compares the production implementation against the designs.

## Release status

The [manual release matrix](combobox-screen-reader-matrix.md) remains **Not run** for screen-reader speech, real on-screen keyboards, and actual browser zoom. Existing [performance evidence](combobox-performance.md) records headless Chromium results; foreground-display validation remains pending. These open release checks do not constitute design-review findings or completed release certification.
