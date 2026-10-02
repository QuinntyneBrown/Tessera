# Contributing to Tessera

Thank you for your interest in contributing. Tessera accepts improvements to
requirements, designs, documentation, accessibility, and implementation.

Read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating.
[AGENTS.md](AGENTS.md) is the source of truth for project conventions.

## Before starting

Search existing [issues](https://github.com/QuinntyneBrown/Tessera/issues) and
[pull requests](https://github.com/QuinntyneBrown/Tessera/pulls) for related work.
For a substantial feature or public API change, describe the use case and
proposed scope in an issue so contributors can coordinate.

Small corrections can be submitted directly as a pull request.

The repository is currently in the design stage. It has no Angular workspace,
package installation workflow, or production test commands. Do not describe
planned behavior as an implemented capability.

## Reporting bugs and requesting features

Follow [SUPPORT.md](SUPPORT.md). Include enough information to reproduce a bug
or assess a feature request.

Report suspected vulnerabilities privately through [SECURITY.md](SECURITY.md).
Do not place credentials, learner records, private course content, or exploit
details in public issues.

## Development workflow

1. Fork the repository and create a branch from `main`.
2. Read the relevant [requirements](docs/specs/) and
   [detailed design](docs/detailed-designs/README.md).
3. Define a small, reviewable slice of behavior.
4. Make the change using the acceptance workflow below.
5. Run the relevant checks available in the repository.
6. Update documentation and submit a pull request against `main`.

Keep each pull request focused on one problem. Describe its resulting behavior
and provide the evidence needed to review it.

## Acceptance test-driven development

Every production feature implementation follows
[Addy Osmani's incremental approach](https://addyosmani.com/blog/ai-coding-workflow/)
and acceptance test-driven development (ATDD):

1. Write Given-When-Then acceptance criteria for one slice.
2. Write the acceptance test.
3. Run the test and confirm it fails for the expected missing behavior.
4. Implement only what satisfies that slice.
5. Refactor with the tests green.
6. Run the relevant regression checks before starting the next slice.

Keep criteria, tests, and implementation aligned. Do not add acceptance tests
after a bulk implementation, skip required tests, or weaken assertions to
produce a passing result.

Frontend acceptance tests use Playwright with the Page Object Model. One page
object per screen owns its selectors and interactions. Tests express intent
and contain no selectors. Configure and run frontend tests in Chromium only.

Tests verify behavior. Do not add tests that inspect repository structure,
naming, banned API usage, or requirement traceability.

UI mocks and prototypes are design artifacts. They do not require ATDD or
tests. ATDD begins when a mock becomes a production implementation.

## Accessibility

Every component change includes automated accessibility checks and manual
screen reader verification. Player-owned interactions must meet WCAG 2.2 AA,
follow applicable WAI-ARIA Authoring Practices, and work with keyboard alone.

Verify JAWS, NVDA, VoiceOver, TalkBack, and Narrator on their supported platforms.
Record the operating system, browser, screen reader version, steps, and result
for each manual verification. Automated frontend tests remain Chromium-only.

Every component must remain fully usable at viewport widths from 320 CSS px to
extra-large, at up to 400% browser zoom, with text enlarged to 200%, and with
WCAG text-spacing overrides applied, without horizontal scrolling or loss of
content or functionality.

Include evidence for accessible names, focus visibility and movement, status
announcements, and unavailable actions. When layout or styles change, also
include evidence at 320, 576, 768, 992, 1200, and 1920 px; at 400% zoom in a
1280 px window; at 200% text size; and with text-spacing overrides applied.
If required verification is incomplete, identify the gap in the pull request;
the component change is not ready to merge.

## Code and architecture

Implement the least code that satisfies the acceptance criteria without
reducing their scope. Prefer clear names, direct control flow, and explicit
ownership of state.

Follow the layout in [AGENTS.md](AGENTS.md). Build configuration uses Angular
CLI and ng-packagr. The player supports browser execution and has no secondary
entry points.

Document public inputs, callbacks, events, and failure behavior. Preserve
edition-specific SCORM rules and the host LMS's responsibility for identity,
authorization, delivery, and durable storage.

Use synthetic fixtures for learner data and only course assets that can legally
be redistributed.

## Documentation changes

Use concise, factual language. Distinguish implemented behavior from plans and
open decisions. Keep relative links valid and update diagram sources together
with their rendered images.

For documentation-only changes, check wording, links, and rendering. Production
behavior tests are not required for documentation or UI mocks.

## Pull request expectations

Include:

- The problem and resulting behavior.
- Related issues and requirement identifiers, where applicable.
- The acceptance slice and evidence of the expected failing test before implementation.
- Relevant test results and any remaining limitations.
- Accessibility verification for component changes.
- Documentation and public API changes.

Do not include unrelated refactors or generated files that are not needed by the
change. Address review feedback and rerun the affected checks after revisions.

Use a descriptive commit subject. A subject such as
`docs: add contributor guidance` or `fix(scorm-player): retain unsaved state`
helps readers identify the change.

## Licensing contributions

By submitting a contribution, contributors agree to license it under Tessera's
[MIT License](LICENSE). Contributors retain copyright in their work.

Include required attribution and license notices for third-party material.
Identify external code, images, fixtures, or documents in the pull request.
