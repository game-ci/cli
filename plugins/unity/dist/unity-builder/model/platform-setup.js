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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const core = __importStar(require("@actions/core"));
const platform_setup_1 = require("./platform-setup/");
const validate_windows_1 = __importDefault(require("./platform-validation/validate-windows"));
class PlatformSetup {
    static async setup(buildParameters, actionFolder) {
        PlatformSetup.SetupShared(buildParameters, actionFolder);
        switch (process.platform) {
            case 'win32':
                validate_windows_1.default.validate(buildParameters);
                platform_setup_1.SetupWindows.setup(buildParameters);
                break;
            case 'darwin':
                await platform_setup_1.SetupMac.setup(buildParameters, actionFolder);
                break;
            // Add other baseOS's here
        }
    }
    static SetupShared(buildParameters, actionFolder) {
        const servicesConfigPath = `${actionFolder}/unity-config/services-config.json`;
        const servicesConfigPathTemplate = `${servicesConfigPath}.template`;
        if (!node_fs_1.default.existsSync(servicesConfigPathTemplate)) {
            core.error(`Missing services config ${servicesConfigPathTemplate}`);
            return;
        }
        let servicesConfig = node_fs_1.default.readFileSync(servicesConfigPathTemplate).toString();
        servicesConfig = servicesConfig.replace('%URL%', buildParameters.unityLicensingServer);
        node_fs_1.default.writeFileSync(servicesConfigPath, servicesConfig);
        platform_setup_1.SetupAndroid.setup(buildParameters);
    }
}
exports.default = PlatformSetup;
