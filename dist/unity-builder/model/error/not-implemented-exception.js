"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class NotImplementedException extends Error {
    constructor(message = '') {
        super(message);
        this.name = 'NotImplementedException';
    }
}
exports.default = NotImplementedException;
