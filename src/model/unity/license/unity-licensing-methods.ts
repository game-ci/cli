import { UnityLicensingMethod } from './unity-licensing-method.ts';

export class UnityLicensingMethods {
  public static get all() {
    return [
      UnityLicensingMethod.Auto,
      UnityLicensingMethod.Personal,
      UnityLicensingMethod.Serial,
      UnityLicensingMethod.Floating,
      UnityLicensingMethod.File,
    ];
  }

  /** Every method except `auto` - i.e. the values the scripts actually branch on. */
  public static get resolved() {
    return UnityLicensingMethods.all.filter((method) => method !== UnityLicensingMethod.Auto);
  }
}
