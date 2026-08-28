import { SignCommand } from "./sign-command";

/**
 * Code-signing and notarization plugin - `game-ci sign <buildPath> --platform macos|windows`.
 *
 * Engine-agnostic: signs an already-built player executable/app bundle,
 * so it doesn't matter which engine produced it. Registered with
 * engine: '*' (see PluginRegistry.createCommand's wildcard handling),
 * mirroring test-runtime/deploy's dispatch shape. Requires `sign` to be
 * registered in core's CliCommands/CommandFactory as an engine-
 * independent top-level command (mirrors test-runtime's registration).
 */
export const codeSigningPlugin = {
  name: "code-signing",
  version: "0.1.0",

  commands: [
    {
      engine: "*",
      createCommand(command: string, _subCommands: string[]) {
        if (command === "sign") {
          return new SignCommand();
        }
        return null;
      },
    },
  ],
};

export default codeSigningPlugin;
export { SignCommand } from "./sign-command";
export { MacosSigner, codesignArgs, dittoZipArgs, notarytoolSubmitArgs, staplerArgs } from "./macos-signer";
export { WindowsSigner, signtoolArgs } from "./windows-signer";
