import { YargsInstance, YargsArguments } from '../dependencies.ts';
import { IOptions } from './options-interface.ts';

export class AndroidOptions implements IOptions {
  public static configure(yargs: YargsInstance): void {
    yargs
      .options({
        androidAppBundle: {
          description: 'Build an Android App Bundle',
          type: 'boolean',
          demandOption: false,
          deprecated: 'Use androidExportType instead',
        },
        androidExportType: {
          description: 'Export type for Android Build',
          type: 'string',
          demandOption: false,
          choices: ['androidPackage', 'androidAppBundle', 'androidStudioProject'],
          conflicts: ['androidAppBundle'],
          default: 'androidPackage',
        }
      })
      .middleware([AndroidOptions.determineExportType])
      .option('androidSymbolType', {
        description: 'Debug symbol type to export with Android build',
        type: 'string',
        demandOption: false,
        choices: ['none', 'public', 'debugging'],
        default: 'none',
      })
      .options({
        androidKeystoreName: {
          description: 'Name of the keystore',
          type: 'string',
          demandOption: false,
          default: '',
        },
        androidKeystoreBase64: {
          description: 'Base64 encoded contents of the keystore',
          type: 'string',
          demandOption: false,
          default: '',
        },
        androidKeystorePass: {
          description: 'Password for the keystore',
          type: 'string',
          demandOption: false,
          default: '',
          deprecated: 'Use androidKeystorePassword instead',
        },
        androidKeystorePassword: {
          description: 'Password for the keystore',
          type: 'string',
          demandOption: false,
          default: '',
        },
        androidKeyAlias: {
          description: 'Alias for the keystore',
          type: 'string',
          demandOption: false,
          default: '',
        },
        androidKeyAliasName: {
          description: 'Name of the keystore',
          type: 'string',
          demandOption: false,
          default: '',
          deprecated: 'Use androidKeyAlias instead',
        },
        androidKeyAliasPassword: {
          description: 'Password for the androidKeyAlias',
          type: 'string',
          demandOption: false,
          default: '',
          requires: ['androidKeyAlias'],
        },
        androidKeyAliasPass: {
          description: 'Password for the androidKeyAlias',
          type: 'string',
          demandOption: false,
          default: '',
          deprecated: 'Use androidKeyAliasPassword instead',
        },
      })
      .option('androidTargetSdkVersion', {
        description: 'Custom Android SDK target version',
        type: 'number',
        demandOption: false,
        default: '',
      })
      .default('androidSdkManagerParameters', '') // Placeholder, consumed in middleware
      .middleware([AndroidOptions.determineSdkManagerParameters]);
  }

  private static determineSdkManagerParameters(argv: YargsArguments) {
    const { androidTargetSdkVersion } = argv;

    if (!androidTargetSdkVersion) return;

    argv.androidSdkManagerParameters = `platforms;android-${androidTargetSdkVersion}`;
  }

  // Can be removed when androidAppBundle is removed
  private static determineExportType(argv: YargsArguments) {
    const { androidAppBundle } = argv;

    if (androidAppBundle) {
      argv.androidExportType = 'androidAppBundle';
    }
  }
}
