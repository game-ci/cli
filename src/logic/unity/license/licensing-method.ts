import type { Options } from '../../../dependencies.ts';
import { UnityLicensingMethod } from '../../../model/unity/license/unity-licensing-method.ts';

/**
 * Forwards an explicitly-chosen activation strategy to the platform scripts as
 * UNITY_LICENSING_METHOD, and forwards nothing at all on `auto`.
 *
 * Deliberately NOT an auto-detector - resolving a strategy centrally here
 * would just be a second implementation of the same decision the platform
 * scripts already make, with the two free to drift apart. All four scripts
 * now share one canonical order - file -> serial -> floating -> personal
 * (game-ci/cli#256 unified the windows *container* script set, which used to
 * check floating before serial) - and each also now warns out loud whenever
 * a credential naming a *specific* strategy gets silently overridden by
 * `auto` resolving to a different one, so a surprising choice is visible in
 * the log instead of only discoverable by reading this source (see
 * warn_if_licensing_method_ambiguous / Write-LicensingMethodAmbiguityWarning
 * in each platform's own licensing_method.{sh,ps1}).
 *
 * `--unityLicensingMethod <strategy>` is the explicit escape hatch: it wins
 * over every chain, on every platform, and is the only way to force one.
 */
export function resolveLicensingMethod(options: Options): string {
  const { unityLicensingMethod } = options;

  if (!unityLicensingMethod || unityLicensingMethod === UnityLicensingMethod.Auto) {
    return '';
  }

  return unityLicensingMethod;
}

// A third approach lived here briefly (game-ci/cli#255): unconditionally
// preferring `personal` over `file` whenever a .ulf and full account
// credentials were both present, forced through --unityLicensingMethod the
// same way an explicit override works. It fixed the "Machine bindings don't
// match" failure for the Unity versions that hit it, but broke activation
// outright on older Unity versions (2020.3.49f1 confirmed live against
// MirrorNetworking/Mirror), whose bundled Unity.Licensing.Client predates
// the --activate-all/--include-personal flags `personal` activation needs -
// versions where plain `file` activation was never broken in the first
// place. A static, version-blind preference can't get both right at once.
// The actual fix now lives in each platform's own activate.{sh,ps1}: try
// `file` first, unconditionally (so every setup that already worked, on any
// Unity version, keeps working exactly as before), and fall back to
// `personal` only on the one specific, recognisable failure signature that
// means the file's machine binding doesn't match this machine - see
// resolve_unity_licensing_method's neighbouring comment in each
// licensing_method.{sh,ps1} for where that fallback is recorded so
// return_license.{sh,ps1} returns the right thing too.
