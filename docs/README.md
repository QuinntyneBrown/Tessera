# Tessera documentation

Tessera is in the design stage. The documents below describe the planned SCORM
player and its implementation constraints.

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

- [Contributing](../CONTRIBUTING.md): contribution workflow, ATDD, and verification.
- [Project rules](../AGENTS.md): repository layout and implementation constraints.
- [Security](../SECURITY.md): private vulnerability reporting and integration boundaries.
- [Support](../SUPPORT.md): questions, defects, and feature proposals.
- [Governance](../GOVERNANCE.md): responsibilities and project decisions.
- [Code of Conduct](../CODE_OF_CONDUCT.md): community expectations.
- [Changelog](../CHANGELOG.md): notable project changes.
