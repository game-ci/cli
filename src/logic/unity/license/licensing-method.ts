import type { Options } from '../../../dependencies.ts';
import { UnityLicensingMethod } from '../../../model/unity/license/unity-licensing-method.ts';
import { UnityLicense } from '../../../model/unity/license/unity-license.ts';

/**
 * Forwards an explicitly-chosen activation strategy to the platform scripts as
 * UNITY_LICENSING_METHOD, and forwards nothing at all on `auto`.
 *
 * Deliberately NOT an auto-detector. It would be tidier for the CLI to resolve
 * one strategy centrally, but the four activate scripts do not agree on
 * precedence and never have: ubuntu, mac and windows/steps check
 * file -> serial -> floating, while the windows *container* script checks
 * file -> floating -> serial. So `UNITY_SERIAL` + `UNITY_LICENSING_SERVER`
 * together select serial on three platforms and floating on the fourth.
 *
 * Any single central order would therefore silently change activation for
 * some existing configuration on some platform. Leaving `auto` to each
 * script's own unchanged chain keeps every currently-working setup byte-
 * identical; each chain gains `personal` only as a new terminal branch, which
 * can just be reached by credentials that previously matched nothing.
 *
 * Unifying that divergence is a real cleanup, but it is a behaviour change
 * that deserves its own PR rather than riding along inside a feature.
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

/**
 * Upgrades a `.ulf` + Unity-account combination to a portable, account-bound
 * serial activation, in place, before any script or docker env var is built.
 *
 * Unity removed manual (offline) activation for Personal seats, so any .ulf
 * still in circulation for a free/personal account is cryptographically
 * bound to whichever machine originally requested it - loading it directly
 * (`-manualLicenseFile`) on a *different* machine fails with "Machine
 * bindings don't match". Every ephemeral CI runner is a different machine on
 * every run, so a personal .ulf handed to one can basically never load
 * directly there. It can only ever have worked for someone in this situation
 * because something else was deriving a portable serial from it instead -
 * exactly what unity-test-runner's own pre-thin-wrapper Docker logic did,
 * silently, before it started shelling out to this CLI (reported live
 * against game-ci/unity-test-runner#310's migration).
 *
 * A personal .ulf's `<DeveloperData Value="...">` blob decodes to that same
 * serial - the standard, documented shape of a personal license file - so it
 * can be extracted here and forwarded as UNITY_SERIAL instead of the raw
 * file. That needs no new activation strategy and no change to the four
 * platform scripts' own precedence chains, which resolveLicensingMethod
 * above already commits to leaving alone: every chain already puts a
 * *complete* serial+email+password triple ahead of `file` (see
 * licensing_method.sh's own precedence comment - `file`'s condition is
 * gated on the triple being incomplete, even though it's checked textually
 * first). Simply completing that triple here is enough to make each
 * platform's own existing `serial` branch win, unchanged, everywhere.
 *
 * Deliberately narrow, so it can only ever help, never surprise an existing
 * setup:
 *  - No-op whenever unitySerial, or an explicit non-auto
 *    --unityLicensingMethod, is already set - never second-guesses an
 *    explicit choice.
 *  - No-op without both unityEmail and unityPassword - there would be
 *    nothing to activate a derived serial *with*, so the existing raw-file
 *    behaviour (correct for a self-hosted runner with a persistent,
 *    already-matching .ulf) is the only option left, and stays untouched.
 *  - No-op whenever extraction fails - an Enterprise/Industry .ulf isn't
 *    guaranteed to carry this same embedded-serial shape, so a miss here
 *    just falls through to the existing file behaviour rather than erroring.
 *  - Only reads options.unityLicense (already resolved to real file content
 *    by this option's own .coerce, whether the input was inline XML or a
 *    host path) - never options.unityLicenseFile, which names a path meant
 *    to be read *inside the container*, not necessarily one that exists on
 *    the host process running this function.
 *
 * Mutates options.unitySerial in place (rather than returning a value) so
 * every existing consumer of the options bag - SecretRedaction.
 * registerFromOptions, UnityEnvironment.getVariables, and each platform's
 * own unchanged chain - picks it up for free, with no new plumbing anywhere
 * else. Returns whether it did, purely so the caller can log it.
 */
export function deriveSerialFromLicenseIfNeeded(options: Options): boolean {
  if (options.unitySerial) return false;
  if (options.unityLicensingMethod && options.unityLicensingMethod !== UnityLicensingMethod.Auto) return false;
  if (!options.unityEmail || !options.unityPassword) return false;
  if (!options.unityLicense || !UnityLicense.isValidLicenseFileContents(options.unityLicense)) return false;

  try {
    const serial = UnityLicense.getLicenseSerialFromUlf(options.unityLicense);
    if (!serial) return false;

    options.unitySerial = serial;
    return true;
  } catch {
    // Not the expected personal-license shape - leave the raw .ulf as the
    // only option, exactly as if this function didn't exist.
    return false;
  }
}
