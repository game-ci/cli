import { components } from '@octokit/openapi-types';
export declare function timeHelper(seconds: number): string;
export declare abstract class Meta {
    title: string;
    duration: number;
    constructor(title: string);
    abstract get summary(): string;
    abstract get mark(): string;
}
export type Annotation = components['schemas']['check-annotation'];
export declare class RunMeta extends Meta {
    total: number;
    passed: number;
    skipped: number;
    failed: number;
    tests: TestMeta[];
    suites: RunMeta[];
    extractAnnotations(): Annotation[];
    addTests(testSuite: TestMeta[]): void;
    addTest(test: TestMeta): void;
    get summary(): string;
    get mark(): string;
}
export declare class TestMeta extends Meta {
    suite: string;
    result: string | undefined;
    annotation: Annotation | undefined;
    constructor(suite: string, title: string);
    isSkipped(): boolean;
    isFailed(): boolean;
    get summary(): string;
    get mark(): string;
}
