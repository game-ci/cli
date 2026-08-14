"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cli = exports.PluginOptions = void 0;
/**
 * Shared options bridge between unity-builder and plugins (e.g. @game-ci/orchestrator).
 *
 * Plugins set PluginOptions.options to pass configuration into BuildParameters
 * and Input. When options are set, isPluginMode is true and query() reads
 * from the options map instead of @actions/core.getInput().
 */
class PluginOptions {
    static options;
    static get isPluginMode() {
        return Boolean(PluginOptions.options?.mode);
    }
    static query(key, alternativeKey) {
        if (PluginOptions.options && PluginOptions.options[key] !== undefined) {
            return PluginOptions.options[key];
        }
        if (PluginOptions.options &&
            alternativeKey &&
            PluginOptions.options[alternativeKey] !== undefined) {
            return PluginOptions.options[alternativeKey];
        }
        return;
    }
}
exports.PluginOptions = PluginOptions;
exports.Cli = PluginOptions;
