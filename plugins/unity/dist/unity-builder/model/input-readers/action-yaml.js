"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionYamlReader = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const yaml_1 = __importDefault(require("yaml"));
class ActionYamlReader {
    actionYamlParsed;
    constructor() {
        let filename = `action.yml`;
        if (!node_fs_1.default.existsSync(filename)) {
            filename = node_path_1.default.join(__dirname, `..`, filename);
        }
        this.actionYamlParsed = yaml_1.default.parse(node_fs_1.default.readFileSync(filename).toString());
    }
    GetActionYamlValue(key) {
        return this.actionYamlParsed.inputs[key]?.description || 'No description found in action.yml';
    }
}
exports.ActionYamlReader = ActionYamlReader;
