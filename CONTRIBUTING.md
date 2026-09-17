# Contributing

## How to Contribute

#### Code of Conduct

This repository has adopted the Contributor Covenant as it's Code of Conduct. It is expected that participants adhere to
it.

#### Proposing a Change

If you are unsure about whether or not a change is desired, you can create an issue. This is useful because it creates
the possibility for a discussion that's visible to everyone.

When fixing a bug it is fine to submit a pull request right away.

#### Sending a Pull Request

Steps to be performed to submit a pull request:

1. Fork the repository and create your branch from `main`.
2. Run `yarn` in the repository root.
3. If you've fixed a bug or added code that should be tested, add tests!
4. Fill out the description, link any related issues and submit your pull request.

#### Pull Request Prerequisites

You have [Node](https://nodejs.org/) installed at v12.2.0+ and [Yarn](https://yarnpkg.com/) at v1.18.0+.

Please note that commit hooks will run automatically to perform some tasks;

- format your code
- run tests
- build distributable files

#### Windows users

Make sure your editor and terminal that run the tests are set to `Powershell 7` or above with
`Git's Unix tools for Windows` installed. Some tests require you to be able to run `sh` and other unix commands.

#### License

By contributing to this repository, you agree that your contributions will be licensed under its MIT license.

#### Cutting a release

Always cut a release with `scripts/release/cut-release.sh <tag>` from a checkout of the commit
you intend to release, rather than `gh release create` directly. `cliVersion: latest` and the `v0`
major tag resolve to a release the instant it's published, but binary build+attach happens
asynchronously afterward and can fail on one platform without failing the others visibly - a
plain `gh release create` leaves "latest" pointing at a release with no usable binaries until
someone notices and fixes it (this took ~6 hours once, breaking every consumer on `latest` in the
meantime - see [#285](https://github.com/game-ci/cli/issues/285)).

The script creates the release as a draft (never resolved by `/releases/latest`), builds and
attaches binaries to it while still a draft, verifies every expected asset actually landed, and
only then publishes - so `latest` never resolves to an incomplete release.
