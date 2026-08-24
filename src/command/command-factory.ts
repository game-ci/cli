import { NonExistentCommand } from "./null/non-existent-command.ts";
import { CommandInterface } from "./command-interface.ts";
import { Engine } from "../model/engine/engine.ts";
import { OpenConfigFolderCommand } from "./config/open-config-folder-command.ts";
import { BuildImageCommand } from "./build-image/build-image-command.ts";
import { PluginRegistry } from "../plugin/plugin-registry.ts";

export class CommandFactory {
  private engine: string = Engine.unknown;
  private engineVersion!: string;

  constructor() {}

  selectEngine(engine: string, engineVersion: string) {
    this.engine = engine;
    this.engineVersion = engineVersion;

    return this;
  }

  public createCommand(commandArray: string[]): CommandInterface {
    // Structure looks like:  _: [ "build" ], or _: [ "config", "open" ]
    const [command, ...subCommands] = commandArray;

    if (command === "config") {
      return this.createConfigCommand(command, subCommands);
    }

    // build-unity-image doesn't require engine detection
    if (command === "build-unity-image") {
      return new BuildImageCommand(command);
    }

    // deploy doesn't require engine detection either - it operates on a
    // pre-built output folder (e.g. `game-ci deploy steam ./build`), and
    // that folder's contents don't carry any Unity/Godot/Unreal project
    // markers for detectEngine() to find. Dispatched via the '*' engine
    // wildcard in PluginRegistry.createCommand.
    // test-runtime doesn't require engine detection either, for the same
    // reason deploy doesn't: it launches an already-built player
    // executable, which carries no Unity/Godot/Unreal project markers of
    // its own for detectEngine() to find.
    if (command === "deploy" || command === "test-runtime") {
      const pluginCommand = PluginRegistry.createCommand("*", command, subCommands);
      if (pluginCommand) {
        return pluginCommand;
      }

      return new NonExistentCommand([command, ...subCommands].join(" "));
    }

    if (this.engine === Engine.unknown) {
      throw new Error("Engine not detected from projectPath");
    }

    // Query the plugin registry for a command matching this engine
    const pluginCommand = PluginRegistry.createCommand(this.engine, command, subCommands);
    if (pluginCommand) {
      return pluginCommand;
    }

    throw new Error(`Engine "${this.engine}" is registered but has no handler for command "${command}".`);
  }

  private createConfigCommand(command: string, subCommands: string[]) {
    switch (subCommands[0]) {
      case "open":
        return new OpenConfigFolderCommand(command);
      default:
        return new NonExistentCommand([command, ...subCommands].join(" "));
    }
  }
}
