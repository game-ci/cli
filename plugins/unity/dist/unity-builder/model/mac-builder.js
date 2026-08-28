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
const exec_1 = require("@actions/exec");
const core = __importStar(require("@actions/core"));
class MacBuilder {
    // A known, transient macOS/Unity flake: the Licensing Client's own
    // codesign verification occasionally fails right after a fresh Unity
    // Hub install on a GitHub-hosted runner, before any real build work has
    // started (confirmed against game-ci/unity-builder#844's CI - the exact
    // same job config passed a few minutes later in a sibling run). It's not
    // something this tool can fix in Unity itself, but failing the whole
    // build - and the PR check along with it - on a licensing hiccup that
    // has nothing to do with the actual build's correctness is exactly the
    // kind of false negative that erodes trust in CI. Retry a few times
    // before surfacing it as a real failure.
    static TRANSIENT_LICENSING_ERROR_PATTERN = /Error: Code 10 while verifying Licensing Client signature/;
    static MAX_ATTEMPTS = 3;
    static RETRY_DELAY_MS = 10_000;
    static async run(actionFolder, silent = false) {
        let exitCode = 1;
        for (let attempt = 1; attempt <= MacBuilder.MAX_ATTEMPTS; attempt++) {
            let output = '';
            // eslint-disable-next-line no-await-in-loop
            exitCode = await (0, exec_1.exec)('bash', [`${actionFolder}/platforms/mac/entrypoint.sh`], {
                silent,
                ignoreReturnCode: true,
                listeners: {
                    stdout: (data) => {
                        output += data.toString();
                    },
                    stderr: (data) => {
                        output += data.toString();
                    },
                },
            });
            if (exitCode === 0)
                return exitCode;
            if (!MacBuilder.TRANSIENT_LICENSING_ERROR_PATTERN.test(output))
                return exitCode;
            if (attempt === MacBuilder.MAX_ATTEMPTS)
                break;
            core.warning(`Unity's Licensing Client hit a transient signature-verification error (attempt ${attempt}/${MacBuilder.MAX_ATTEMPTS}). Retrying in ${MacBuilder.RETRY_DELAY_MS / 1000}s.`);
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => {
                setTimeout(resolve, MacBuilder.RETRY_DELAY_MS);
            });
        }
        return exitCode;
    }
}
exports.default = MacBuilder;
