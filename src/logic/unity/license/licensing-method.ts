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
