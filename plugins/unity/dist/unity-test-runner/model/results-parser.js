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
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const xmljs = __importStar(require("xml-js"));
const results_meta_1 = require("./results-meta");
const path_1 = __importDefault(require("path"));
const ResultsParser = {
    async parseResults(filepath) {
        if (!fs.existsSync(filepath)) {
            throw new Error(`Missing file! {"filepath": "${filepath}"}`);
        }
        core.info(`Trying to open ${filepath}`);
        const file = await fs.promises.readFile(filepath, 'utf8');
        const results = xmljs.xml2js(file, { compact: true });
        core.info(`File ${filepath} parsed...`);
        return ResultsParser.convertResults(path_1.default.basename(filepath), results);
    },
    convertResults(filename, filedata) {
        core.info(`Start analyzing results: ${filename}`);
        const run = filedata['test-run'];
        const runMeta = new results_meta_1.RunMeta(filename);
        const tests = ResultsParser.convertSuite(run['test-suite']);
        core.debug(tests.toString());
        runMeta.total = Number(run._attributes.total);
        runMeta.failed = Number(run._attributes.failed);
        runMeta.skipped = Number(run._attributes.skipped);
        runMeta.passed = Number(run._attributes.passed);
        runMeta.duration = Number(run._attributes.duration);
        runMeta.addTests(tests);
        return runMeta;
    },
    convertSuite(suites) {
        if (Array.isArray(suites)) {
            const innerResult = [];
            for (const suite of suites) {
                innerResult.push(...ResultsParser.convertSuite(suite));
            }
            return innerResult;
        }
        const result = [];
        const innerSuite = suites['test-suite'];
        if (innerSuite) {
            result.push(...ResultsParser.convertSuite(innerSuite));
        }
        const tests = suites['test-case'];
        if (tests) {
            result.push(...ResultsParser.convertTests(suites._attributes.fullname, tests));
        }
        return result;
    },
    convertTests(suite, tests) {
        if (Array.isArray(tests)) {
            const result = [];
            for (const testCase of tests) {
                result.push(ResultsParser.convertTestCase(suite, testCase));
            }
            return result;
        }
        return [ResultsParser.convertTestCase(suite, tests)];
    },
    convertTestCase(suite, testCase) {
        const { _attributes, failure, output } = testCase;
        const { name, fullname, result, duration } = _attributes;
        const testMeta = new results_meta_1.TestMeta(suite, name);
        testMeta.result = result;
        testMeta.duration = Number(duration);
        if (!failure) {
            core.debug(`Skip test ${fullname} without failure data`);
            return testMeta;
        }
        core.debug(`Convert data for test ${fullname}`);
        if (failure['stack-trace'] === undefined) {
            core.warning(`No stack trace for test case: ${fullname}`);
            return testMeta;
        }
        const trace = failure['stack-trace']._cdata;
        if (trace === undefined) {
            core.warning(`No cdata in stack trace for test case: ${fullname}`);
            return testMeta;
        }
        const point = ResultsParser.findAnnotationPoint(trace);
        if (!point.path || !point.line) {
            core.warning(`Not able to find annotation point for failed test! Test trace: ${trace}`);
            return testMeta;
        }
        const rawDetails = [trace];
        if (output && output._cdata) {
            rawDetails.unshift(output._cdata);
        }
        else {
            core.debug(`No console output for test case: ${fullname}`);
        }
        testMeta.annotation = {
            path: point.path,
            start_line: point.line,
            end_line: point.line,
            annotation_level: 'failure',
            title: fullname,
            message: failure.message._cdata ? failure.message._cdata : 'Test Failed!',
            raw_details: rawDetails.join('\n'),
            start_column: 0,
            end_column: 0,
            blob_href: '',
        };
        core.info(`- ${testMeta.annotation.path}:${testMeta.annotation.start_line} - ${testMeta.annotation.title}`);
        return testMeta;
    },
    findAnnotationPoint(trace) {
        const regex = /at(?: .* in)? ((?<path>[^:]+):(?<line>\d+))/;
        // Find first entry with non-zero line number in stack trace
        const items = trace.match(new RegExp(regex, 'g'));
        if (Array.isArray(items)) {
            const result = [];
            for (const item of items) {
                const match = item.match(regex);
                const point = {
                    path: match ? match.groups.path : '',
                    line: match ? Number(match.groups.line) : 0,
                };
                if (point.line > 0) {
                    result.push(point);
                }
            }
            if (result.length > 0) {
                return result[0];
            }
        }
        // If all entries have zero line number match fallback pattern
        const match = trace.match(regex);
        return {
            path: match ? match.groups.path : '',
            line: match ? Number(match.groups.line) : 0,
        };
    },
};
exports.default = ResultsParser;
