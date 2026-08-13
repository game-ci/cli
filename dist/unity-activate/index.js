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
exports.run = run;
const core = __importStar(require("@actions/core"));
const model_1 = require("./model");
/**
 * Exported so this can be invoked in-process (e.g. an npm-package delegation
 * mechanism) as well as as a standalone script (subprocess delegation) — the
 * CLI-to-destination invocation mechanism is still an open decision, see
 * game-ci/roadmap#11 workstream 2. Both options stay viable from this shape.
 */
async function run() {
    try {
        model_1.Action.checkCompatibility();
        const { dockerfile, workspace, actionFolder } = model_1.Action;
        const unityVersion = model_1.Input.unityVersion;
        const baseImage = new model_1.ImageTag(unityVersion);
        // Build docker image
        const actionImage = await model_1.Docker.build({ path: actionFolder, dockerfile, baseImage });
        // Run docker image
        await model_1.Docker.run(actionImage, { workspace, unityVersion });
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
// Only auto-run when executed directly (subprocess/script invocation),
// not when imported as a library (in-process invocation).
if (require.main === module) {
    run();
}
