"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CommandExecutionError extends Error {
    constructor(message = '') {
        super(message);
        this.name = 'CommandExecutionError';
    }
}
exports.default = CommandExecutionError;
