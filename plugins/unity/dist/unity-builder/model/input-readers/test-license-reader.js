"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadLicense = ReadLicense;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const yaml_1 = __importDefault(require("yaml"));
const input_1 = __importDefault(require("../input"));
function ReadLicense() {
    if ((input_1.default.getInput('providerStrategy') || 'local') === 'local') {
        return '';
    }
    const pipelineFile = node_path_1.default.join(__dirname, `.github`, `workflows`, `orchestrator-k8s-pipeline.yml`);
    return node_fs_1.default.existsSync(pipelineFile)
        ? yaml_1.default.parse(node_fs_1.default.readFileSync(pipelineFile, 'utf8')).env.UNITY_LICENSE
        : '';
}
