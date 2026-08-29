> **EXPERIMENTAL.** Functional, and registered by default in every `game-ci`
> binary (no `--plugin` flag needed) - not published to npm, so it's loaded
> via a literal `import()` compiled directly into the binary instead.

# @game-ci/code-signing

`game-ci sign <buildPath> --platform macos|windows` signs (and, on
macOS, notarizes and staples) a built player. An unsigned macOS build is
blocked by Gatekeeper; an unsigned Windows build is flagged by
SmartScreen - both real, common pain points outside Steam/console
storefronts (direct download, itch.io).

## macOS

```bash
APPLE_ID=... APPLE_TEAM_ID=... APPLE_APP_SPECIFIC_PASSWORD=... game-ci \
  sign ./build/Game.app --platform macos --identity "Developer ID Application: Studio Name (TEAM123)"
```

Runs `codesign` with the hardened runtime enabled (required for
notarization since macOS 10.15), then by default zips the app with
`ditto` (preserves bundle structure, unlike a plain `zip`), submits it
via `xcrun notarytool submit --wait`, and staples the ticket with `xcrun
stapler staple` on success. Pass `--notarize=false` to sign without
notarizing.

Credentials are read from `$APPLE_ID`/`$APPLE_TEAM_ID`/
`$APPLE_APP_SPECIFIC_PASSWORD` only, never CLI arguments - the app-specific
password is generated at https://appleid.apple.com, not your regular
Apple ID password.

## Windows

```bash
WINDOWS_CERTIFICATE_PASSWORD=... game-ci \
  sign ./build/Game.exe --platform windows --certificatePath ./cert.pfx --timestampUrl http://timestamp.digicert.com
```

Runs `signtool sign` with SHA-256 file and timestamp digests (the modern
mode - `signtool`'s legacy SHA-1-only mode is deprecated and
increasingly rejected by SmartScreen). Pass either `--certificatePath`
(a PFX file, password from `$WINDOWS_CERTIFICATE_PASSWORD`) or
`--certificateThumbprint` (a certificate already in the Windows
certificate store) - not both.

`--timestampUrl` is strongly recommended: without an RFC 3161 timestamp,
the signature becomes invalid the moment the certificate expires, even
for builds already shipped.

## Options

| Option                    | Platform | Description                                                          |
| -------------------------- | -------- | ---------------------------------------------------------------------- |
| `--platform`                | both     | `macos` or `windows`. Required.                                      |
| `--identity`                | macOS    | Code signing identity. Falls back to `$APPLE_SIGNING_IDENTITY`.      |
| `--entitlementsPath`        | macOS    | Path to an entitlements `.plist`, if the app needs any.              |
| `--notarize`                | macOS    | Submit for notarization and staple after signing. Default `true`.    |
| `--certificatePath`         | Windows  | Path to a PFX certificate file.                                      |
| `--certificateThumbprint`   | Windows  | Thumbprint of a certificate in the Windows certificate store.        |
| `--timestampUrl`            | Windows  | RFC 3161 timestamp server URL.                                       |

## What isn't covered yet

Cloud/HSM-based Windows signing (e.g. Azure Trusted Signing, increasingly
required as traditional EV certificate issuance has gotten harder for
indies) isn't wired up - only local `signtool` with a PFX file or a
certificate-store thumbprint. Real certificates can't be part of an
automated test fixture, so the signing tool invocations themselves are
unit-tested with a mocked process runner (argument construction,
credential handling, and the macOS sign→zip→notarize→staple sequencing
are covered); an actual signing/notarization run hasn't been exercised
against real Apple/Microsoft infrastructure in this session.
