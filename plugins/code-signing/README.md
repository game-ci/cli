> **EXPERIMENTAL — NOT IMPLEMENTED.** This is a structural draft only: the plugin
> shape is real, but its domain logic is not written. Any command it claims will
> throw. It is not published to npm and is never loaded unless you pass
> `--plugin @game-ci/code-signing` explicitly.

# @game-ci/code-signing (draft)

macOS notarization (`xcrun notarytool` + stapling) and Windows
Authenticode signing for built players. **Not functional yet**, and
`sign` is not yet registered anywhere in core's CLI.

## Why this

Real, common pain point currently entirely hand-rolled per studio: an
unsigned macOS build gets blocked by Gatekeeper, an unsigned Windows
build gets flagged by SmartScreen. Distribution outside Steam/console
storefronts (direct download, itch.io) hits this immediately.

## Remaining work before this is real

1. Add `sign <buildPath>` to core's `CliCommands`.
2. macOS path: codesign the `.app` bundle with a Developer ID
   certificate, submit to `xcrun notarytool submit --wait`, staple the
   ticket on success. Certificate/App-Store-Connect-API-key handling via
   environment variables only, matching `steam-deploy`'s credential
   convention.
3. Windows path: Authenticode signing via `signtool.exe` (or an HSM/cloud
   signing service like Azure Trusted Signing, increasingly required
   since traditional EV cert issuance has gotten harder for indies) -
   needs real research into which signing backends are actually
   accessible to indie/small studios today before picking one to
   implement first.
4. Tests once the above is real - likely needs to mock the actual
   signing tool invocations, since real certificates can't be part of a
   test fixture.
