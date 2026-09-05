import type { YargsInstance } from '../dependencies.ts';
import { UnityTargetPlatform } from '../model/unity/target-platform/unity-target-platform.ts';
import { UnityTargetPlatforms } from '../model/unity/target-platform/unity-target-platforms.ts';
import { IOptions } from './options-interface.ts';
import { UnityLicense } from '../model/unity/license/unity-license.ts';
import { UnityLicensingMethod } from '../model/unity/license/unity-licensing-method.ts';
import { UnityLicensingMethods } from '../model/unity/license/unity-licensing-methods.ts';
import * as nodeFs from 'node:fs';

export class UnityOptions implements IOptions {
  public static configure = async (yargs: YargsInstance): Promise<void> => {
    await yargs
      .option('targetPlatform', {
        alias: 't',
        description: 'The platform to build your project for',
        choices: UnityTargetPlatforms.all,
        demandOption: false,
        default: UnityTargetPlatform.default,
      })
      .options({
        // Default to the matching UNITY_* env var, not just an empty string:
        // these carry secrets (passwords, license contents), so callers like
        // unity-activate's thin wrapper need to pass them via the child
        // process's environment rather than argv, which can leak through
        // process listings and exec-style command logging.
        unityEmail: {
          alias: 'u',
          description: 'Email address for your Unity account',
          type: 'string',
          demandOption: false,
          default: process.env.UNITY_EMAIL || '',
        },
        unityPassword: {
          alias: 'p',
          description: 'Password for your Unity account',
          type: 'string',
          demandOption: false,
          default: process.env.UNITY_PASSWORD || '',
        },
        unitySerial: {
          alias: 's',
          description: 'Serial number identifying a pro-license seat',
          type: 'string',
          demandOption: false,
          default: process.env.UNITY_SERIAL || '',
        },
        unityLicense: {
          alias: 'l',
          description: 'Contents of, or path to your Unity License File (.ulf)',
          type: 'string',
          demandOption: false,
          default: process.env.UNITY_LICENSE || '',
        },
        // Consumed by dist/platforms/*/steps/activate.{sh,ps1}, which have
        // always branched on UNITY_LICENSE_FILE - but the option was never
        // declared here, so environment.ts's `options.unityLicenseFile` read
        // was always undefined and getEnvVarString dropped it. The env var
        // therefore never reached the container and the documented flag was
        // dead. Declared so it actually works.
        unityLicenseFile: {
          alias: 'lf',
          description: 'Path to a Unity License File (.ulf) on the host filesystem',
          type: 'string',
          demandOption: false,
          default: process.env.UNITY_LICENSE_FILE || '',
        },
        unityLicensingServer: {
          alias: 'ls',
          description: 'Licensing server to use for Unity activation',
          type: 'string',
          demandOption: false,
          default: process.env.UNITY_LICENSING_SERVER || '',
        },
        unityLicensingToolset: {
          alias: 'lt',
          description:
            'Toolset identifier for floating-license servers that host multiple toolsets. Empty by default.',
          type: 'string',
          demandOption: false,
          default: '',
        },
        licenseRetryMaxAttempts: {
          description: String.dedent`Number of times to retry Unity activation/build on a known-transient
          Unity licensing-server error (timeout, "0 entitlement groups", "No valid Unity Editor license
          found", etc. - see mac/steps/activate.sh and build.sh). Set to 1 to disable retrying - e.g. if
          a persistent license failure is being masked by retries instead of failing fast.`,
          type: 'number',
          demandOption: false,
          default: 4,
        },
        unityLicensingMethod: {
          description: String.dedent`
            Which activation strategy to use.

            'auto' (the default) picks one from the credentials you provided, in order:
            serial -> file (.ulf) -> floating -> personal. Set it explicitly to force one.`,
          choices: UnityLicensingMethods.all,
          demandOption: false,
          default: UnityLicensingMethod.default,
        },
      })
      .coerce('unityLicense', async (arg: string) => {
        if (UnityLicense.isNonActivatedLicenseFile(arg)) {
          // Unity removed manual (offline) activation for Personal licenses:
          // license.unity3d.com/manual now redirects to /new and reports
          // "Offline activation is available only for Enterprise and Industry
          // seats". The old advice - "go activate the .alf and come back with
          // a .ulf" - is unfollowable on a free seat, so point at the
          // licensing-client path rather than at a dead end.
          throw new Error(String.dedent`Unity License File (.ulf) expected, but got .alf.

          Turning an .alf into a .ulf requires manual (offline) activation, which Unity now
          restricts to Enterprise and Industry seats.

          On a Personal (free) seat, drop the license file entirely and activate with your
          Unity account instead: set unityEmail (UNITY_EMAIL) and unityPassword
          (UNITY_PASSWORD), which resolves to --unityLicensingMethod personal.`);
        }

        return UnityLicense.isValidLicenseFilePath(arg) ? nodeFs.readFileSync(arg, 'utf-8') : arg;
      })
      .option('customImage', {
        description: String.dedent`
          Custom docker image to use inside the command.
          For more information see https://game.ci/docs/docker/versions`,
        type: 'string',
      })
      .option('usymUploadAuthToken', {
        description: '<missing description>',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('customParameters', {
        description: String.dedent`
          Custom parameters to configure the build.

          There are 2 main use cases for this option:
          - To pass your own custom parameters to be used with buildMethod above
          - To pass Unity Build Options (for example, customParameters: -EnableHeadlessMode will do server builds)
        `,
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('sshAgent', {
        description: 'SSH Agent path to forward to the container.',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('gitPrivateToken', {
        description: 'Github private token to pull from github.',
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('chownFilesTo', {
        description: String.dedent`
          User and optionally group (user or user:group or uid:gid),
          to give ownership of the resulting build artifacts.`,
        type: 'string',
        demandOption: false,
        default: '',
      })
      .option('cacheUnityInstallationOnMac', {
        description: 'Cache Unity installation on Mac.',
        type: 'boolean',
        demandOption: false,
        default: false,
      })
      .option('unityHubVersionOnMac', {
        description: String.dedent`Unity Hub version to use on Mac.
        Should be of format Major.Minor.Patch, ie 3.4.0.
        An empty string represents the latest available version on homebrew.`,
        type: 'string',
        demandOption: false,
        default: '',
      });
  };
}
