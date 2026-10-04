# Tessera documentation

Tessera includes a SCORM player and an asynchronous multi-select combobox.
Requirements and detailed designs below are the source of intended behavior.

The [combobox adoption guide](../src/combobox/README.md), [implementation evidence](verification/combobox-implementation.md),
and [pending manual release matrix](verification/combobox-screen-reader-matrix.md) describe its current status.

The [combobox engineering review](verification/combobox-engineering-review.md) evaluates
maintainability, implementation rationale, file sizes, and measured browser performance.

## Requirements

| Document | Purpose |
| --- | --- |
| [High-level requirements](specs/L1.md) | Define the player capabilities and quality goals |
| [Detailed requirements](specs/L2.md) | Define behavior and Given-When-Then acceptance criteria |

Each detailed requirement traces to a high-level requirement. These documents
are the source of truth for intended behavior.

## Detailed designs

The [design index](detailed-designs/README.md) maps the requirements to eight
feature designs. Each feature includes its collaborators, requirement
references, PlantUML sources, and rendered diagrams.

Open decisions are marked `<TO SUPPLY>`. Resolve them before implementing the
behavior that depends on them.

## UI reference

Open the [SCORM player mock](mocks/scorm-player/index.html) in a browser to
inspect the proposed interface. It is a design artifact and does not implement
SCORM runtime behavior.

## Contributor resources

- [Manual screen reader verification](verification/manual-screen-reader-verification.md): setup, fixture scenarios, keyboard and mobile procedures, expected behavior, and evidence recording.
- [Contributing](../CONTRIBUTING.md): contribution workflow, ATDD, and verification.
- [Project rules](../AGENTS.md): repository layout and implementation constraints.
- [Security](../SECURITY.md): private vulnerability reporting and integration boundaries.
- [Support](../SUPPORT.md): questions, defects, and feature proposals.
- [Governance](../GOVERNANCE.md): responsibilities and project decisions.
- [Code of Conduct](../CODE_OF_CONDUCT.md): community expectations.
- [Changelog](../CHANGELOG.md): notable project changes.
