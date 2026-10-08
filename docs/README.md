# Tessera documentation

Tessera includes a SCORM player, an asynchronous multi-select combobox, and a real-time video player.
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
SCORM runtime behavior. The [combobox mock](mocks/combobox/index.html) and the
[video player mock](mocks/video-player/index.html) are the same kind of artifact; the
video player mock models the states, controls, and announcements of L2-057 to L2-094
with a locally generated picture and no streaming code.

## Contributor resources

- [Manual screen reader verification](verification/manual-screen-reader-verification.md): setup, fixture scenarios, keyboard and mobile procedures, expected behavior, and evidence recording.
- [Senior Angular Product Engineer assessment](assessments/senior-angular-product-engineer-test.md): a demanding three-hour technical test based on Tessera and the supplied Docebo role.
- [Assessment answers and assessor guide](assessments/senior-angular-product-engineer-answers.md): worked solutions, reference code, and the 100-point rubric; keep separate from candidate material.
- [Contributing](../CONTRIBUTING.md): contribution workflow, ATDD, and verification.
- [Project rules](../AGENTS.md): repository layout and implementation constraints.
- [Security](../SECURITY.md): private vulnerability reporting and integration boundaries.
- [Support](../SUPPORT.md): questions, defects, and feature proposals.
- [Governance](../GOVERNANCE.md): responsibilities and project decisions.
- [Code of Conduct](../CODE_OF_CONDUCT.md): community expectations.
- [Changelog](../CHANGELOG.md): notable project changes.
