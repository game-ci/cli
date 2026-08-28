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
const github = __importStar(require("@actions/github"));
const handlebars_1 = __importDefault(require("handlebars"));
const results_parser_1 = __importDefault(require("./results-parser"));
const results_meta_1 = require("./results-meta");
const path_1 = __importDefault(require("path"));
const results_check_templates_1 = require("./results-check-templates");
const ResultsCheck = {
    async createCheck(artifactsPath, githubToken, checkName) {
        // Validate input
        if (!fs.existsSync(artifactsPath) || !githubToken || !checkName) {
            throw new Error(`Missing input! {"artifactsPath": "${artifactsPath}",  "githubToken": "${githubToken}, "checkName": "${checkName}"`);
        }
        // Parse all results files
        const runs = [];
        const files = fs.readdirSync(artifactsPath);
        await Promise.all(files.map(async (filepath) => {
            if (!filepath.endsWith('.xml'))
                return;
            core.info(`Processing file ${filepath}...`);
            try {
                const content = fs.readFileSync(path_1.default.join(artifactsPath, filepath), 'utf8');
                if (!content.includes('<test-run')) {
                    // noinspection ExceptionCaughtLocallyJS
                    throw new Error('File does not appear to be a NUnit XML file');
                }
                const fileData = await results_parser_1.default.parseResults(path_1.default.join(artifactsPath, filepath));
                core.info(fileData.summary);
                runs.push(fileData);
            }
            catch (error) {
                core.warning(`Failed to parse ${filepath}: ${error.message}`);
            }
        }));
        // Combine all results into a single run summary
        const runSummary = new results_meta_1.RunMeta(checkName);
        for (const run of runs) {
            runSummary.total += run.total;
            runSummary.passed += run.passed;
            runSummary.skipped += run.skipped;
            runSummary.failed += run.failed;
            runSummary.duration += run.duration;
            for (const suite of run.suites) {
                runSummary.addTests(suite.tests);
            }
        }
        // Log
        core.info('=================');
        core.info('Analyze result:');
        core.info(runSummary.summary);
        // Format output
        const title = runSummary.summary;
        const summary = await ResultsCheck.renderSummary(runs);
        core.debug(`Summary view: ${summary}`);
        const details = await ResultsCheck.renderDetails(runs);
        core.debug(`Details view: ${details}`);
        const rawAnnotations = runSummary.extractAnnotations();
        core.debug(`Raw annotations: ${rawAnnotations}`);
        const annotations = rawAnnotations.map((rawAnnotation) => {
            const annotation = rawAnnotation;
            annotation.path = rawAnnotation.path.replace('/github/workspace/', '');
            return annotation;
        });
        core.debug(`Annotations: ${annotations}`);
        const output = {
            title,
            summary,
            text: details,
            annotations: annotations.slice(0, 50),
        };
        // Call GitHub API
        await ResultsCheck.requestGitHubCheck(githubToken, checkName, output);
        return runSummary.failed;
    },
    async requestGitHubCheck(githubToken, checkName, output) {
        const pullRequest = github.context.payload.pull_request;
        const headSha = (pullRequest && pullRequest.head.sha) || github.context.sha;
        // Check max length for https://github.com/game-ci/unity-test-runner/issues/214
        const maxLength = 65_534;
        if (output.text.length > maxLength) {
            core.warning(`Test details of ${output.text.length} surpass limit of ${maxLength}`);
            output.text =
                'Test details omitted from GitHub UI due to length. See console logs for details.';
        }
        core.info(`Posting results for ${headSha}`);
        const createCheckRequest = {
            ...github.context.repo,
            name: checkName,
            head_sha: headSha,
            status: 'completed',
            conclusion: 'neutral',
            output,
        };
        const octokit = github.getOctokit(githubToken);
        await octokit.rest.checks.create(createCheckRequest);
    },
    async renderSummary(runMetas) {
        return ResultsCheck.render(results_check_templates_1.RESULTS_CHECK_SUMMARY_TEMPLATE, runMetas);
    },
    async renderDetails(runMetas) {
        return ResultsCheck.render(results_check_templates_1.RESULTS_CHECK_DETAILS_TEMPLATE, runMetas);
    },
    async render(source, runMetas) {
        handlebars_1.default.registerHelper('indent', (toIndent) => toIndent
            .split('\n')
            .map((s) => `        ${s.replace('/github/workspace/', '')}`)
            .join('\n'));
        const template = handlebars_1.default.compile(source);
        return template({ runs: runMetas }, {
            allowProtoMethodsByDefault: true,
            allowProtoPropertiesByDefault: true,
        });
    },
};
exports.default = ResultsCheck;
