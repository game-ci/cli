import * as core from '@actions/core';
import * as fs from 'fs';
import * as github from '@actions/github';
import Handlebars from 'handlebars';
import ResultsParser from './results-parser';
import { RunMeta } from './results-meta';
import path from 'path';
import { RESULTS_CHECK_DETAILS_TEMPLATE, RESULTS_CHECK_SUMMARY_TEMPLATE } from './results-check-templates';

const ResultsCheck = {
  async createCheck(artifactsPath, githubToken, checkName) {
    // Validate input
    if (!fs.existsSync(artifactsPath) || !githubToken || !checkName) {
      throw new Error(
        `Missing input! {"artifactsPath": "${artifactsPath}",  "githubToken": "${githubToken}, "checkName": "${checkName}"`,
      );
    }

    // Parse all results files
    const runs: RunMeta[] = [];
    const files = fs.readdirSync(artifactsPath);
    await Promise.all(
      files.map(async (filepath) => {
        if (!filepath.endsWith('.xml')) return;
        core.info(`Processing file ${filepath}...`);
        try {
          const content = fs.readFileSync(path.join(artifactsPath, filepath), 'utf8');
          if (!content.includes('<test-run')) {
            // noinspection ExceptionCaughtLocallyJS
            throw new Error('File does not appear to be a NUnit XML file');
          }
          const fileData = await ResultsParser.parseResults(path.join(artifactsPath, filepath));
          core.info(fileData.summary);
          runs.push(fileData);
        } catch (error: any) {
          core.warning(`Failed to parse ${filepath}: ${error.message}`);
        }
      }),
    );

    // Combine all results into a single run summary
    const runSummary = new RunMeta(checkName);
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

  // Truncating beats discarding. The overflow branch used to replace the whole
  // body with a one-line apology, so the larger the suite the less its check
  // said - a 1532-test run rendered to 146600 characters and got nothing back.
  // Keeping the first 65534 characters keeps most of the detail for exactly
  // the runs that need it most.
  truncateDetails(text: string, maxLength: number): string {
    const notice = '\n\n_Test details truncated to fit GitHub\u2019s size limit - see the console log for the rest._';

    if (text.length <= maxLength) {
      return text;
    }

    // A budget this small cannot fit the notice, let alone any detail. Nothing
    // sensible is left to show, so say only that.
    if (notice.length >= maxLength) {
      return 'Test details omitted from GitHub UI due to length. See console logs for details.';
    }

    // Cut on a line boundary so the markdown does not end mid-table-row, which
    // renders as a broken cell rather than as a shorter table.
    const cut = text.slice(0, maxLength - notice.length);
    const lastNewline = cut.lastIndexOf('\n');

    return (lastNewline > 0 ? cut.slice(0, lastNewline) : cut) + notice;
  },

  async requestGitHubCheck(githubToken, checkName, output) {
    const pullRequest = github.context.payload.pull_request;
    const headSha = (pullRequest && pullRequest.head.sha) || github.context.sha;

    // Check max length for https://github.com/game-ci/unity-test-runner/issues/214
    const maxLength = 65_534;
    if (output.text.length > maxLength) {
      core.warning(`Test details of ${output.text.length} surpass limit of ${maxLength}`);
      output.text = ResultsCheck.truncateDetails(output.text, maxLength);
    }

    core.info(`Posting results for ${headSha}`);
    const createCheckRequest = {
      ...github.context.repo,
      name: checkName,
      head_sha: headSha,
      status: 'completed' as const,
      conclusion: 'neutral' as const,
      output,
    };

    const octokit = github.getOctokit(githubToken);
    await octokit.rest.checks.create(createCheckRequest);
  },

  async renderSummary(runMetas) {
    return ResultsCheck.render(RESULTS_CHECK_SUMMARY_TEMPLATE, runMetas);
  },

  async renderDetails(runMetas) {
    return ResultsCheck.render(RESULTS_CHECK_DETAILS_TEMPLATE, runMetas);
  },

  async render(source, runMetas) {
    Handlebars.registerHelper('indent', (toIndent) =>
      toIndent
        .split('\n')
        .map((s) => `        ${s.replace('/github/workspace/', '')}`)
        .join('\n'),
    );
    const template = Handlebars.compile(source);
    return template(
      { runs: runMetas },
      {
        allowProtoMethodsByDefault: true,
        allowProtoPropertiesByDefault: true,
      },
    );
  },
};

export default ResultsCheck;
