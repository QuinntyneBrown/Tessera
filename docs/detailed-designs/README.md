# Tessera detailed designs

## Overview

Tessera is a browser component library for learning management systems (LMSs). Its first package, `@tessera/scorm-player`, loads and plays SCORM learning content.

**SCORM** — Sharable Content Object Reference Model, the course packaging and browser runtime protocol defined by ADL

Its second package, `@tessera/combobox`, provides an asynchronous multi-select combobox. Its designs are in the [combobox subsystem](combobox/).

The `scorm-player` subsystem follows the capability grouping in [L1 requirements](../specs/L1.md) and [L2 requirements](../specs/L2.md). The flat specification folder contains no predefined subsystem folders.

The combobox designs describe the implemented browser package. The SCORM designs include capabilities beyond the current implementation; its delivery scope is recorded in [implementation status](implementation-status.md). HTML mocks provide visual references independently of production behavior.

## Description

Eight player features cover `L2-001` to `L2-021`. Ten [combobox features](combobox/) cover `L2-022` to `L2-050`:

| Feature | Capability |
|---------|------------|
| [Integrate the host LMS](scorm-player/integrate-host/) | `L2-014`, `L2-021` |
| [Load and validate a course](scorm-player/load-course/) | `L2-001`, `L2-002`, `L2-003`, `L2-016`, `L2-019` |
| [Launch an isolated activity](scorm-player/launch-activity/) | `L2-004`, `L2-015`, `L2-016` |
| [Run edition-specific SCORM sessions](scorm-player/run-scorm-session/) | `L2-007`, `L2-008`, `L2-009`, `L2-010` |
| [Navigate permitted course activities](scorm-player/navigate-course/) | `L2-005`, `L2-006` |
| [Resume an attempt and report outcomes](scorm-player/resume-and-report-attempt/) | `L2-011`, `L2-012` |
| [Save progress and retry failures](scorm-player/save-progress/) | `L2-013`, `L2-010` |
| [Operate the player accessibly and recover from errors](scorm-player/operate-player/) | `L2-017`, `L2-018`, `L2-020` |

The Angular package runs inside the host LMS browser application. Course scripts run on a distinct, host-provided delivery origin. A browser wrapper exposes the synchronous API beside the SCO and exchanges constrained messages with the host-side component.

The host authorizes course access, binds the attempt to its learner, serves validated course assets, and durably stores attempt snapshots. Tessera has no independent backend or learner authentication service.

The public package has no secondary entry points. Its proposed source layout follows `AGENTS.md`, using Angular CLI and ng-packagr. The upstream comparison is [angular/components' youtube-player package](https://github.com/angular/components/tree/main/src/youtube-player).

Shared types are `CourseSource`, `AttemptContext`, `HostIntegration`, `ValidatedCourse`, `SessionBinding`, `AttemptSnapshot`, `SaveSubmission`, `SaveAck`, `CourseOutcome`, and `PlayerError`. Each feature page describes only its relevant collaborators.

The host-side runtime validates ordered operations before changing authoritative attempt state. Only the selected SCO's allowed values enter the isolated course context. Durable save status advances only on a matching host acknowledgement.

The following decisions remain `<TO SUPPLY>` before their affected production slices:

| Decision | Affected design | Required resolution |
|----------|-----------------|---------------------|
| Synchronous commit and finish policy | [Runtime](scorm-player/run-scorm-session/) and [persistence](scorm-player/save-progress/) | Verify all four editions' permitted buffering, failure codes, transport failures, and durable acknowledgement semantics |
| Complete edition rule definitions | [Loading](scorm-player/load-course/), [runtime](scorm-player/run-scorm-session/), [navigation](scorm-player/navigate-course/), [resume](scorm-player/resume-and-report-attempt/) | Extract edition detection, runtime validation, sequencing, and rollup rules from authoritative ADL specifications |
| Isolated course-delivery contract | [Launch](scorm-player/launch-activity/) | Define wrapper distribution, per-attempt origins, credential isolation, redirect checks, handshake timeouts, and message bounds |
| Host integration and public API release | [Integration](scorm-player/integrate-host/) | Define endpoint authorization and snapshot migration |
| Package and performance configuration | [Loading](scorm-player/load-course/) | Choose archive tooling, safe default limits, organization selection, and reference-machine conditions |
| Persistence across interruptions | [Persistence](scorm-player/save-progress/) | Define crash recovery, duplicate-tab conflicts, retention, and background save policy |
| Manual accessibility procedure | [Player operation](scorm-player/operate-player/) | Supply platform-specific screen reader scripts and record observed results |

The specifications reference ADL's [SCORM 1.2 documentation](https://adlnet.gov/assets/uploads/SCORM_1_2_pdf.zip), [SCORM 2004 3rd Edition documentation](https://adlnet.gov/assets/uploads/SCORM.2004.3ED.DocSuite.zip), and [SCORM 2004 4th Edition documentation](https://adlnet.gov/assets/uploads/SCORM_2004_4ED_v1_1_Doc_Suite.zip). The normative 2nd Edition source and the complete downloaded edition corpora are `<TO SUPPLY>`. The linked archive contents have not been verified in this design pass. Supporting web guidance never substitutes for the detected edition's specification.

Production work follows `AGENTS.md`: one Given-When-Then criterion, one failing acceptance test, the least production change, then relevant regression checks. Feature folders are design units, not permission for bulk implementation.

A practical dependency order starts with the required host contract and isolated extracted-course delivery. It proceeds through one SCO's runtime behavior, saving, resume, navigation rules, and archive loading. Accessible controls and recovery participate in every UI slice. Each supported edition remains unavailable until its required behavior exists.

Frontend acceptance tests use Chromium Playwright and one `PlayerPage` per player screen. The page object owns selectors and interactions. Automated accessibility checks accompany every component change. Manual verification covers JAWS, NVDA, VoiceOver, TalkBack, and Narrator on their supported platforms.

These artifacts do not implement production code or add architecture tests. They do not claim SCORM conformance or completed accessibility verification. Each open detail is a decision to resolve before implementing the behavior that depends on it.

## Requirements

The feature pages preserve each L2 identifier, its L1 parent, and its exact source wording. Their tables quote the specifications' `must`; design prose uses declarative statements or `shall`, `should`, and `may`.

| L2 ID | Refines (L1) | Primary feature |
|-------|--------------|-----------------|
| `L2-001` | `L1-001` | [Load and validate a course](scorm-player/load-course/) |
| `L2-002` | `L1-001` | [Load and validate a course](scorm-player/load-course/) |
| `L2-003` | `L1-001` | [Load and validate a course](scorm-player/load-course/) |
| `L2-004` | `L1-002` | [Launch an isolated activity](scorm-player/launch-activity/) |
| `L2-005` | `L1-002` | [Navigate permitted course activities](scorm-player/navigate-course/) |
| `L2-006` | `L1-002` | [Navigate permitted course activities](scorm-player/navigate-course/) |
| `L2-007` | `L1-003` | [Run edition-specific SCORM sessions](scorm-player/run-scorm-session/) |
| `L2-008` | `L1-003` | [Run edition-specific SCORM sessions](scorm-player/run-scorm-session/) |
| `L2-009` | `L1-003` | [Run edition-specific SCORM sessions](scorm-player/run-scorm-session/) |
| `L2-010` | `L1-003` | [Run edition-specific SCORM sessions](scorm-player/run-scorm-session/) |
| `L2-011` | `L1-004` | [Resume an attempt and report outcomes](scorm-player/resume-and-report-attempt/) |
| `L2-012` | `L1-004` | [Resume an attempt and report outcomes](scorm-player/resume-and-report-attempt/) |
| `L2-013` | `L1-005` | [Save progress and retry failures](scorm-player/save-progress/) |
| `L2-014` | `L1-006` | [Integrate the host LMS](scorm-player/integrate-host/) |
| `L2-015` | `L1-006` | [Launch an isolated activity](scorm-player/launch-activity/) |
| `L2-016` | `L1-006` | [Load and validate a course](scorm-player/load-course/) |
| `L2-017` | `L1-007` | [Operate the player accessibly and recover from errors](scorm-player/operate-player/) |
| `L2-018` | `L1-008` | [Operate the player accessibly and recover from errors](scorm-player/operate-player/) |
| `L2-019` | `L1-008` | [Load and validate a course](scorm-player/load-course/) |
| `L2-020` | `L1-008` | [Operate the player accessibly and recover from errors](scorm-player/operate-player/) |
| `L2-021` | `L1-005` | [Integrate the host LMS](scorm-player/integrate-host/) |

Shared requirements recur where two features enforce the same behavior. `L2-010` connects runtime lifecycle to persistence. `L2-016` connects confined package paths to validated runtime messages and protected diagnostics.

## Diagrams

Each feature contains C4 context, container, and component views, a class diagram, and two behavioral sequence diagrams. Each diagram has a PlantUML source and an inline PNG sibling.

C4 diagrams use offline `<C4/...>` macros. Sequence boxes identify the host browser application, isolated course context, host API, and delivery infrastructure where each participates. Pure browser behaviors omit backend participants they do not call.

The PlantUML renderer from the software-design-document skill writes PNG files beside their sources. Source and image review verifies diagram syntax, links, trust boundaries, message ordering, and requirement references.
