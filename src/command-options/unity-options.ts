import type { YargsInstance } from '../dependencies.ts';
import UnityTargetPlatform from '../model/unity/unity-target-platform.ts';
import { UnityTargetPlatforms } from '../model/unity/unity-target-platforms.ts';

export class UnityOptions {
  public static configure = async (yargs: YargsInstance) => {
    yargs
      .option('targetPlatform', {
        alias: 't',
        description: 'The platform to build your project for',
        choices: UnityTargetPlatforms.all,
        demandOption: false,
        default: UnityTargetPlatform.default,
      })
      .options({
        unityEmail: {
          alias: 'u',
          description: 'Email address for your Unity account',
          type: 'string',
          demandOption: false,
          default: '',
        },
        unityPassword: {
          alias: 'p',
          description: 'Password for your Unity account',
          type: 'string',
          demandOption: false,
          default: '',
        },
        unitySerial: {
          alias: 's',
          description: 'Serial number identifying a pro-license seat',
          type: 'string',
          demandOption: false,
          default: '',
        },
        unityLicense: {
          alias: 'l',
          description: 'Contents of, or path to your Unity License File (.ulf)',
          type: 'string',
          demandOption: false,
          default: '',
        },
      })
      .coerce('unityLicense', async (arg) => {
        return arg.endsWith('.ulf') ? Deno.readTextFile(arg, { encoding: 'utf8' }) : arg;
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
      });
  };
}
