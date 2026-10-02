# Project governance

Tessera uses a maintainer-led model. Contributors propose and implement changes;
the maintainer is responsible for scope, review, releases, and project policies.

## Maintainer

[Quinntyne Brown](https://github.com/QuinntyneBrown) is the project maintainer.

The maintainer reviews contributions, resolves technical decisions, and manages
repository access. Contributors are credited through their commits and pull
requests.

## Decisions

Routine changes are discussed in issues and pull requests. Substantial features
and public API changes begin with a proposal describing the user need, scope,
and consequences.

Requirements live in `docs/specs/`. Detailed designs live in
`docs/detailed-designs/`. Accepted changes update the relevant documents so
implementation and requirements remain aligned.

The maintainer considers contributor feedback and records the reasoning for
decisions that affect architecture, compatibility, accessibility, or security.
When consensus is not reached, the maintainer makes the final project decision.

## Review and merge

Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md) and the project rules in
[AGENTS.md](AGENTS.md). Changes are reviewed before merging.

Required acceptance and regression checks are not waived to accelerate a merge.
Component changes include automated and manual accessibility verification.
Documentation and mocks use the review and verification appropriate to those
artifacts.

## Releases

The maintainer is responsible for release approval, versioning, release notes,
and publication. The [changelog](CHANGELOG.md) records user-visible changes.

No package has been released. Version support and compatibility commitments
will be documented with the first release.

## Community responsibilities

All participants follow the [Code of Conduct](CODE_OF_CONDUCT.md).
Security reports use the private channel in [SECURITY.md](SECURITY.md).

Repository access and maintainer responsibilities can change as the project
grows. Such changes are recorded in this document.
