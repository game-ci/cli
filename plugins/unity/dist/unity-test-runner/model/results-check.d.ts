declare const ResultsCheck: {
    createCheck(artifactsPath: any, githubToken: any, checkName: any): Promise<number>;
    truncateDetails(text: string, maxLength: number): string;
    /**
     * Reads at most `maxBytes` from the start of a file via a bounded
     * fs.readSync, instead of reading the whole file. Exposed as its own
     * method (rather than inlined) so tests can spy on it directly - vitest
     * can't spy on node:fs's own exports under ESM ("Module namespace is not
     * configurable in ESM").
     */
    readFileHead(filePath: string, maxBytes: number): string;
    requestGitHubCheck(githubToken: any, checkName: any, output: any): Promise<void>;
    renderSummary(runMetas: any): Promise<string>;
    renderDetails(runMetas: any): Promise<string>;
    render(source: any, runMetas: any): Promise<string>;
};
export default ResultsCheck;
