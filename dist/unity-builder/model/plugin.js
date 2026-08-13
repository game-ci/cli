"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPlugin = loadPlugin;
const core = __importStar(require("@actions/core"));
const DEFAULT_PLUGIN_MODULE = '@game-ci/orchestrator';
/**
 * Attempt to load the default optional plugin.
 *
 * Today the default implementation is @game-ci/orchestrator. The loader is
 * intentionally named after the generic plugin contract so additional plugin
 * implementations can be added without making orchestrator part of the core
 * abstraction.
 */
async function loadPlugin(moduleName = DEFAULT_PLUGIN_MODULE) {
    try {
        const pluginModule = await Promise.resolve(`${moduleName}`).then(s => __importStar(require(s)));
        if (typeof pluginModule.createPlugin !== 'function') {
            core.warning(`Plugin package "${moduleName}" found but does not export createPlugin(). ` +
                'Update the plugin package to the latest version.');
            return;
        }
        return pluginModule.createPlugin();
    }
    catch (error) {
        if (!isModuleNotFoundError(error)) {
            throw error;
        }
    }
}
function isModuleNotFoundError(error) {
    if (error && typeof error === 'object' && 'code' in error) {
        const code = error.code;
        if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
            return true;
        }
    }
    return (typeof error?.message === 'string' &&
        /cannot find module/i.test(error.message));
}
