"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupAndroid = exports.SetupMac = exports.SetupWindows = void 0;
const setup_windows_1 = __importDefault(require("./setup-windows"));
exports.SetupWindows = setup_windows_1.default;
const setup_mac_1 = __importDefault(require("./setup-mac"));
exports.SetupMac = setup_mac_1.default;
const setup_android_1 = __importDefault(require("./setup-android"));
exports.SetupAndroid = setup_android_1.default;
