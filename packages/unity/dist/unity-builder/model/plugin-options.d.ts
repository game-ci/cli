/**
 * Shared options bridge between unity-builder and plugins (e.g. @game-ci/orchestrator).
 *
 * Plugins set PluginOptions.options to pass configuration into BuildParameters
 * and Input. When options are set, isPluginMode is true and query() reads
 * from the options map instead of @actions/core.getInput().
 */
export declare class PluginOptions {
    static options: Record<string, any> | undefined;
    static get isPluginMode(): boolean;
    static query(key: string, alternativeKey: string): any;
}
export { PluginOptions as Cli };
