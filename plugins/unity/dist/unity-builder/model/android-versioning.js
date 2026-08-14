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
const semver = __importStar(require("semver"));
class AndroidVersioning {
    static determineVersionCode(version, inputVersionCode) {
        if (inputVersionCode === '') {
            return AndroidVersioning.versionToVersionCode(version);
        }
        return inputVersionCode;
    }
    static versionToVersionCode(version) {
        if (version === 'none') {
            core.info(`Versioning strategy is set to ${version}, so android version code should not be applied.`);
            return '0';
        }
        const parsedVersion = semver.parse(version);
        if (!parsedVersion) {
            core.warning(`Could not parse "${version}" to semver, defaulting android version code to 1`);
            return '1';
        }
        // The greatest value Google Plays allows is 2100000000.
        // Allow for 3 patch digits, 3 minor digits and 3 major digits.
        const versionCode = parsedVersion.major * 1000000 + parsedVersion.minor * 1000 + parsedVersion.patch;
        if (versionCode >= 2050000000) {
            throw new Error(`Generated versionCode ${versionCode} is dangerously close to the maximum allowed number 2100000000. Consider a different versioning scheme to be able to continue updating your application.`);
        }
        core.info(`Using android versionCode ${versionCode}`);
        return versionCode.toString();
    }
    static determineSdkManagerParameters(targetSdkVersion) {
        const parsedVersion = Number.parseInt(targetSdkVersion.slice(-2), 10);
        return Number.isNaN(parsedVersion) ? '' : `platforms;android-${parsedVersion}`;
    }
}
exports.default = AndroidVersioning;
