import { RunMeta, TestMeta } from './results-meta';
declare const ResultsParser: {
    parseResults(filepath: any): Promise<RunMeta>;
    convertResults(filename: any, filedata: any): RunMeta;
    convertSuite(suites: any): TestMeta[];
    convertTests(suite: any, tests: any): TestMeta[];
    convertTestCase(suite: any, testCase: any): TestMeta;
    findAnnotationPoint(trace: any): {
        path: any;
        line: number;
    };
};
export default ResultsParser;
