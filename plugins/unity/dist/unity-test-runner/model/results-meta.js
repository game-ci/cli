"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestMeta = exports.RunMeta = exports.Meta = void 0;
exports.timeHelper = timeHelper;
function timeHelper(seconds) {
    return `${seconds.toFixed(3)}s`;
}
class Meta {
    title;
    duration = 0;
    constructor(title) {
        this.title = title;
    }
}
exports.Meta = Meta;
class RunMeta extends Meta {
    total = 0;
    passed = 0;
    skipped = 0;
    failed = 0;
    tests = [];
    suites = [];
    extractAnnotations() {
        const result = [];
        for (const suite of this.suites) {
            result.push(...suite.extractAnnotations());
        }
        for (const test of this.tests) {
            if (test.annotation !== undefined) {
                result.push(test.annotation);
            }
        }
        return result;
    }
    addTests(testSuite) {
        for (const test of testSuite) {
            this.addTest(test);
        }
    }
    addTest(test) {
        if (test.suite === undefined) {
            return;
        }
        if (test.suite === this.title) {
            this.total++;
            this.duration += test.duration;
            this.tests.push(test);
            if (test.result === 'Passed')
                this.passed++;
            else if (test.result === 'Failed')
                this.failed++;
            else
                this.skipped++;
            return;
        }
        let target = this.suites.find((s) => s.title === test.suite);
        if (target === undefined) {
            target = new RunMeta(test.suite);
            this.suites.push(target);
        }
        target.addTest(test);
    }
    get summary() {
        const result = this.failed > 0 ? 'Failed' : 'Passed';
        const sPart = this.skipped > 0 ? `, skipped: ${this.skipped}` : '';
        const fPart = this.failed > 0 ? `, failed: ${this.failed}` : '';
        const dPart = ` in ${timeHelper(this.duration)}`;
        return `${this.mark} ${this.title} - ${this.passed}/${this.total}${sPart}${fPart} - ${result}${dPart}`;
    }
    get mark() {
        if (this.failed > 0)
            return '❌️';
        else if (this.skipped === 0)
            return '✅';
        return '⚠️';
    }
}
exports.RunMeta = RunMeta;
class TestMeta extends Meta {
    suite;
    result;
    annotation;
    constructor(suite, title) {
        super(title);
        this.suite = suite;
        this.result = undefined;
        this.duration = Number.NaN;
    }
    isSkipped() {
        return this.result === 'Skipped';
    }
    isFailed() {
        return this.result === 'Failed';
    }
    get summary() {
        const dPart = this.isSkipped() ? '' : ` in ${timeHelper(this.duration)}`;
        return `${this.mark} **${this.title}** - ${this.result}${dPart}`;
    }
    get mark() {
        if (this.isFailed())
            return '❌️';
        else if (this.isSkipped())
            return '⚠️';
        return '✅';
    }
}
exports.TestMeta = TestMeta;
