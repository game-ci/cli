import type { Options } from '../../../dependencies.ts';
import { UnityLicensingMethod } from '../../../model/unity/license/unity-licensing-method.ts';

/**
 * Resolves which activation strategy the platform scripts should use, so
 * activate.sh/activate.ps1 branch on one value instead of re-deriving the
 * strategy from six separate env vars in three places.
 *
 * `auto` (the default) reproduces the precedence the scripts already have,
 * with one addition at the end:
 *
 *   1. serial   - UNITY_SERIAL + UNITY_EMAIL + UNITY_PASSWORD
 *   2. file     - UNITY_LICENSE / UNITY_LICENSE_FILE (a .ulf)
 *   3. floating - UNITY_LICENSING_SERVER
 *   4. personal - UNITY_EMAIL + UNITY_PASSWORD, via the licensing client
 *
 * Serial outranks file for the reason activate.sh already documents: a
 * manually-activated .ulf is bound to the machine fingerprint of whichever
 * machine originally requested it, which doesn't necessarily match the runner.
 *
 * Personal deliberately sits *last*, not next to the other credential-based
 * strategies. Floating-server users commonly set unityEmail/unityPassword
 * alongside unityLicensingServer, so checking personal any earlier would
 * quietly steal those runs away from their license server. Last position makes
 * it purely additive: the only configuration whose behaviour changes is
 * email+password with no serial, no license file and no server, which today
 * falls through to activate.sh's "License activation strategy could not be
 * determined" and exits 1.
 *
 * Returns '' when nothing matched, leaving the scripts to emit their existing
 * "could not be determined" guidance rather than duplicating it here.
 */
export function resolveLicensingMethod(options: Options): string {
  const {
    unityLicensingMethod,
    unityLicense,
    unityLicenseFile,
    unitySerial,
    unityEmail,
    unityPassword,
    unityLicensingServer,
  } = options;

  if (unityLicensingMethod && unityLicensingMethod !== UnityLicensingMethod.Auto) {
    return unityLicensingMethod;
  }

  if (unitySerial && unityEmail && unityPassword) {
    return UnityLicensingMethod.Serial;
  }

  if (unityLicense || unityLicenseFile) {
    return UnityLicensingMethod.File;
  }

  if (unityLicensingServer) {
    return UnityLicensingMethod.Floating;
  }

  if (unityEmail && unityPassword) {
    return UnityLicensingMethod.Personal;
  }

  return '';
}
