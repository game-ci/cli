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
const core = __importStar(require("@actions/core"));
const exec_1 = require("@actions/exec");
class System {
    static async run(command, arguments_ = [], options = {}, shouldLog = true) {
        let result = '';
        let error = '';
        let debug = '';
        const listeners = {
            stdout: (dataBuffer) => {
                result += dataBuffer.toString();
            },
            stderr: (dataBuffer) => {
                error += dataBuffer.toString();
            },
            debug: (dataString) => {
                debug += dataString;
            },
        };
        const showOutput = () => {
            if (debug !== '' && shouldLog) {
                core.debug(debug);
            }
            if (result !== '' && shouldLog) {
                core.info(result);
            }
            if (error !== '' && shouldLog) {
                core.warning(error);
            }
        };
        const throwContextualError = (message) => {
            let commandAsString = command;
            if (Array.isArray(arguments_)) {
                commandAsString += ` ${arguments_.join(' ')}`;
            }
            else if (typeof arguments_ === 'string') {
                commandAsString += ` ${arguments_}`;
            }
            throw new Error(`Failed to run "${commandAsString}".\n ${message}`);
        };
        try {
            if (command.trim() === '') {
                throw new Error(`Failed to execute empty command`);
            }
            const exitCode = await (0, exec_1.exec)(command, arguments_, { silent: true, listeners, ...options });
            showOutput();
            if (exitCode !== 0) {
                throwContextualError(`Command returned non-zero exit code.\nError: ${error}`);
            }
        }
        catch (inCommandError) {
            showOutput();
            throwContextualError(`In-command error caught: ${inCommandError}`);
        }
        return result;
    }
}
exports.default = System;
