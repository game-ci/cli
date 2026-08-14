declare const ResultsCheck: {
    createCheck(artifactsPath: any, githubToken: any, checkName: any): Promise<number>;
    requestGitHubCheck(githubToken: any, checkName: any, output: any): Promise<void>;
    renderSummary(runMetas: any): Promise<string>;
    renderDetails(runMetas: any): Promise<string>;
    render(viewPath: any, runMetas: any): Promise<string>;
};
export default ResultsCheck;
