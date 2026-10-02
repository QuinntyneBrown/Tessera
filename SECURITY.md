# Security policy

## Supported versions

Tessera has not released a production package. Security reports affecting the
current repository, designs, mock, or development work are welcome.

A supported-version table will be published with the first release. This policy
does not imply that an unreleased implementation is suitable for production.

## Reporting a vulnerability

Email [quinntynebrown@gmail.com](mailto:quinntynebrown@gmail.com) with the subject
`[Tessera security] <brief description>`.

Do not report vulnerability details through public issues, pull requests, or
discussions. GitHub private vulnerability reporting is not currently enabled
for this repository; use the email address above.

Include, where available:

- The affected commit, file, or package version.
- A description of the vulnerability and its impact.
- Configuration and steps needed to reproduce it.
- A minimal proof of concept using synthetic data.
- Any proposed mitigation or fix.
- Whether the issue has been disclosed elsewhere.

Do not send credentials, learner records, or proprietary course packages.
If sensitive material is needed to reproduce the issue, first request an
appropriate transfer method.

## Review and disclosure

The maintainer reviews reports privately and coordinates investigation,
mitigation, and disclosure with the reporter. Disclosure should give affected
users enough information to assess impact and take corrective action.

Response and remediation times depend on severity and maintainer availability.
There is no guaranteed response time or bug bounty program. If a report receives
no response, follow up through the same email channel.

A confirmed issue may result in a fix, advisory, design change, or documented
limitation. Credit is included with the reporter's consent.

## Security scope

The planned SCORM player handles untrusted archives, manifests, course scripts,
runtime values, and bridge messages. Relevant reports include:

- Access from course content to host credentials, application state, or another attempt.
- Forged or stale runtime messages that change unauthorized state.
- Path traversal, unsafe resource origins, or archive limits that can be bypassed.
- Learner data disclosed through URLs, logs, or diagnostic events.
- Persistence behavior that mixes learners, courses, or attempts.

The host LMS remains responsible for learner identity, authorization, course
delivery, and durable storage. A report that crosses the integration boundary
should identify both the player behavior and the host configuration.

See the [detailed requirements](docs/specs/L2.md) and
[designs](docs/detailed-designs/README.md) for the proposed boundaries. These
documents describe requirements and designs, not verified security guarantees.

## Non-security reports

Use [SUPPORT.md](SUPPORT.md) for ordinary defects, documentation corrections,
and feature requests. If the security impact is uncertain, use the private
reporting channel first.
