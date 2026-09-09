import type { Options } from '../../../dependencies.ts';
import { UnityLicensingMethod } from '../../../model/unity/license/unity-licensing-method.ts';

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
 * Prefers account-based `personal` activation over loading a `.ulf` directly,
 * whenever both are available and no genuine serial was given.
 *
 * Unity removed manual (offline) activation for Personal seats, so any .ulf
 * still in circulation for a free/personal account is cryptographically
 * bound to whichever machine originally requested it - loading it directly
 * (`-manualLicenseFile`) on a *different* machine fails with "Machine
 * bindings don't match". Every ephemeral CI runner is a different machine on
 * every run, so a personal .ulf handed to one can essentially never load
 * directly there.
 *
 * An earlier version of this function tried to extract the serial embedded
 * in a personal .ulf's `<DeveloperData Value="...">` blob and forward it as
 * UNITY_SERIAL, reusing each platform's existing serial+email+password
 * precedence to activate portably instead of switching strategy outright.
 * That worked end-to-end against a synthetic license file (mutation, docker
 * env var construction, shell quoting - all verified directly), but still
 * failed against at least one real user's actual .ulf in production
 * (reported live against game-ci/unity-test-runner, MirrorNetworking/
 * Mirror#4127) - something about a real, current personal .ulf's shape
 * doesn't match closely enough for extraction to produce something Unity's
 * licensing client accepts, and there is no way to get a real sample to
 * debug further (it is, correctly, a secret). Two independent users
 * separately arrived at the same workaround by hand: drop the .ulf entirely
 * and provide just the account credentials. This function encodes that
 * workaround directly - forcing --unityLicensingMethod=personal through the
 * existing explicit-override mechanism (resolveLicensingMethod above) - the
 * same escape hatch a user would reach for by hand, so it needs no new
 * per-platform script logic either.
 *
 * Deliberately narrow, so it can only ever help, never surprise an existing
 * setup:
 *  - No-op whenever unitySerial is already set - a real Pro/Plus/Enterprise
 *    serial should never be second-guessed.
 *  - No-op whenever an explicit non-auto --unityLicensingMethod is already
 *    set - never second-guesses an explicit choice, including `file` for
 *    someone who deliberately wants the raw-file behaviour.
 *  - No-op without both unityEmail and unityPassword - there would be
 *    nothing to activate personally *with*, so the existing raw-file
 *    behaviour (correct for a self-hosted runner with a persistent,
 *    already-matching .ulf and no account credentials at all) is the only
 *    option left, and stays untouched.
 *  - No-op without a license file at all (unityLicense or
 *    unityLicenseFile) - nothing to prefer personal activation *over*.
 */
export function preferPersonalOverFile(options: Options): boolean {
  if (options.unitySerial) return false;
  if (options.unityLicensingMethod && options.unityLicensingMethod !== UnityLicensingMethod.Auto) return false;
  if (!options.unityEmail || !options.unityPassword) return false;
  if (!options.unityLicense && !options.unityLicenseFile) return false;

  options.unityLicensingMethod = UnityLicensingMethod.Personal;
  return true;
}
