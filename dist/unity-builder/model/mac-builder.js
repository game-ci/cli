"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const exec_1 = require("@actions/exec");
class MacBuilder {
    static async run(actionFolder, silent = false) {
        return await (0, exec_1.exec)('bash', [`${actionFolder}/platforms/mac/entrypoint.sh`], {
            silent,
            ignoreReturnCode: true,
        });
    }
}
exports.default = MacBuilder;
