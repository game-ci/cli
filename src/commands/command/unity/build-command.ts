import { CommandInterface } from '../command-interface.ts';
import { Action, Cache, Docker, ImageTag, Input, Output } from '../../../model/index.ts';
import PlatformSetup from '../../../model/platform-setup.ts';
import MacBuilder from '../../../model/mac-builder.ts';
import { CommandBase } from './command-base.ts';

export class BuildCommand extends CommandBase implements CommandInterface {
  public async validate() {
    await super.validate();
  }

  public async execute(): Promise<boolean> {
    try {
      const { workspace, actionFolder } = Action;
      const { parameters, env } = this.options;

      Action.checkCompatibility();
      Cache.verify();

      const baseImage = new ImageTag(parameters);
      log.debug('baseImage', baseImage);

      await PlatformSetup.setup(parameters, actionFolder);
      if (env.getOS() === 'darwin') {
        MacBuilder.run(actionFolder, workspace, parameters);
      } else {
        await Docker.run(baseImage, { workspace, actionFolder, ...parameters });
      }

      // const result = await exec('docker run -it unityci/editor:2020.3.15f2-base-1 /bin/bash -c "echo test"', {
      //   output: OutputMode.Capture,
      //   continueOnError: true,
      //
      //   // verbose: true,
      // });
      //
      // log.info('result', result.output);
      // const { success } = result.status;
      // log.info('success', success);
      //
      // return success;

      // Set output
      await Output.setBuildVersion(parameters.buildVersion);
    } catch (error) {
      log.error(error);
      Deno.exit(1);
    }
  }
}
