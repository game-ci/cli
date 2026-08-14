"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericInputReader = void 0;
const node_child_process_1 = require("node:child_process");
const input_1 = __importDefault(require("../input"));
class GenericInputReader {
    static async Run(command) {
        if ((input_1.default.getInput('providerStrategy') || 'local') === 'local') {
            return '';
        }
        return new Promise((resolve, reject) => {
            (0, node_child_process_1.exec)(command, { maxBuffer: 1024 * 10000 }, (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout.toString());
            });
        });
    }
}
exports.GenericInputReader = GenericInputReader;
