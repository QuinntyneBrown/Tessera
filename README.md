# Tessera

Tessera is a component library for Angular applications. Its goal is to provide
accessible, reusable components with clear public APIs and tested behavior.

The first package, `@tessera/scorm-player`, is designed to let learning management
systems (LMSs) deliver SCORM courses through an embedded browser player. The
player handles course loading, navigation, runtime communication, and learner
state while the host LMS controls identity, authorization, delivery, and storage.

[Documentation](docs/README.md) · [Contributing](CONTRIBUTING.md) ·
[Support](SUPPORT.md) · [Security](SECURITY.md)

## Components

| Package | Purpose |
| --- | --- |
| `@tessera/scorm-player` | Embed SCORM learning content in an Angular LMS |
| [`@tessera/combobox`](src/combobox/README.md) | Search and select multiple remote values with keyboard-operable chips |

## Shared themes

[`@tessera/theme`](src/theme/README.md) provides typed semantic tokens, light/dark defaults, and scoped theme helpers for both components. The dev app includes an interactive theme example. Existing combobox CSS overrides remain supported.

## SCORM player

The player's intended capabilities include:

- Load a SCORM ZIP package or an extracted course using its manifest URL.
- Identify and apply SCORM 1.2 or SCORM 2004 2nd, 3rd, and 4th Edition rules.
- Launch course activities and provide navigation that respects course sequencing.
- Expose the edition-specific runtime API and validate its data model and errors.
- Restore learner attempts and report progress, completion, success, and scores.
- Save state through host callbacks and retain unsaved changes for retry.
- Isolate untrusted course content from the host application and other attempts.
- Provide responsive controls and actionable loading, runtime, and save errors.

See the [high-level requirements](docs/specs/L1.md) and
[detailed requirements](docs/specs/L2.md) for the complete scope.

## LMS integration

The integration contract is designed to let a host LMS supply a course source,
an authorized attempt context, isolated course delivery, and persistence
functions. State, outcome, and error events give the host visibility into the
learner's attempt.

The player owns SCORM behavior and its user interface. The host owns learner
authentication, access decisions, and durable storage. See the
[host integration design](docs/detailed-designs/scorm-player/integrate-host/)
for the proposed boundary.

## Accessibility

Player-owned controls target WCAG 2.2 AA and the applicable WAI-ARIA Authoring
Practices. Every component change requires keyboard verification, automated
accessibility checks, and manual verification with JAWS, NVDA, VoiceOver,
TalkBack, and Narrator on their supported platforms.

Frontend automated tests use Playwright in Chromium only. Manual screen reader
verification uses the appropriate supported platform.

## Architecture

Tessera follows the layout and conventions of
[angular/components](https://github.com/angular/components), with Angular CLI
and ng-packagr for builds and browser execution as its supported target.
Server-side rendering is outside the project scope.

The player is designed as one standalone Angular package under
`src/scorm-player/`, without secondary entry points. Examples, development
applications, component harnesses, and acceptance applications support library
development and consumer integration. The target layout is specified in
[AGENTS.md](AGENTS.md).

## Documentation

- [Documentation index](docs/README.md): requirements, designs, and contributor resources.
- [High-level requirements](docs/specs/L1.md): capabilities and quality goals.
- [Detailed requirements](docs/specs/L2.md): behavior and acceptance criteria.
- [Detailed designs](docs/detailed-designs/README.md): feature architecture and diagrams.
- [Player UI reference](docs/mocks/scorm-player/index.html): proposed interface, viewable in a browser.

## Development status

Tessera is in the design stage, with requirements, detailed designs, and a UI
mock. The production library has not been implemented or released. Installation
and usage instructions will accompany the first usable package.

## Contributing

Contributions to requirements, designs, documentation, and implementation are
welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow and
[AGENTS.md](AGENTS.md) for the project rules.

Production features use incremental implementation and acceptance test-driven
development: define one behavior, prove its acceptance test fails, implement the
smallest change, and pass the relevant regression checks before continuing.

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
Project decision-making is described in [GOVERNANCE.md](GOVERNANCE.md).

## Support and security

Use [SUPPORT.md](SUPPORT.md) for questions, bug reports, and feature requests.
Report suspected vulnerabilities privately using [SECURITY.md](SECURITY.md).

## License

Tessera is licensed under the [MIT License](LICENSE).
