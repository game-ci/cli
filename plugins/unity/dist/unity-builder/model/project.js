"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const input_1 = __importDefault(require("./input"));
const unity_1 = __importDefault(require("./unity"));
const action_1 = __importDefault(require("./action"));
class Project {
    static get relativePath() {
        const { projectPath } = input_1.default;
        return `${projectPath}`;
    }
    static get absolutePath() {
        const { workspace } = action_1.default;
        return `${workspace}/${this.relativePath}`;
    }
    static get libraryFolder() {
        return `${this.relativePath}/${unity_1.default.libraryFolder}`;
    }
}
exports.default = Project;
