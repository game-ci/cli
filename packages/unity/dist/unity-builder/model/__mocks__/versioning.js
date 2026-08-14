"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockGit = exports.mockGetTotalNumberOfCommits = exports.mockHasAnyVersionTags = exports.mockGetTag = exports.mockIsDirty = exports.mockGetVersionDescription = exports.mockFetch = exports.mockParseSemanticVersion = exports.mockGenerateTagVersion = exports.mockGenerateSemanticVersion = exports.mockDetermineVersion = exports.mockRef = exports.mockHeadRef = exports.mockBranch = exports.mockIsDirtyAllowed = exports.mockProjectPath = void 0;
const vitest_1 = require("vitest");
/* eslint unicorn/prevent-abbreviations: "off" */
// Import these named export into your test file:
exports.mockProjectPath = vitest_1.vi.fn().mockResolvedValue('mockProjectPath');
exports.mockIsDirtyAllowed = vitest_1.vi.fn().mockResolvedValue(false);
exports.mockBranch = vitest_1.vi.fn().mockResolvedValue('mockBranch');
exports.mockHeadRef = vitest_1.vi.fn().mockResolvedValue('mockHeadRef');
exports.mockRef = vitest_1.vi.fn().mockResolvedValue('mockRef');
exports.mockDetermineVersion = vitest_1.vi.fn().mockResolvedValue('1.2.3');
exports.mockGenerateSemanticVersion = vitest_1.vi.fn().mockResolvedValue('2.3.4');
exports.mockGenerateTagVersion = vitest_1.vi.fn().mockResolvedValue('1.0');
exports.mockParseSemanticVersion = vitest_1.vi.fn().mockResolvedValue({});
exports.mockFetch = vitest_1.vi.fn().mockImplementation(() => { });
exports.mockGetVersionDescription = vitest_1.vi.fn().mockResolvedValue('1.2-3-g12345678-dirty');
exports.mockIsDirty = vitest_1.vi.fn().mockResolvedValue(false);
exports.mockGetTag = vitest_1.vi.fn().mockResolvedValue('v1.0');
exports.mockHasAnyVersionTags = vitest_1.vi.fn().mockResolvedValue(true);
exports.mockGetTotalNumberOfCommits = vitest_1.vi.fn().mockResolvedValue(3);
exports.mockGit = vitest_1.vi.fn().mockImplementation(() => { });
exports.default = {
    projectPath: exports.mockProjectPath,
    isDirtyAllowed: exports.mockIsDirtyAllowed,
    branch: exports.mockBranch,
    headRef: exports.mockHeadRef,
    ref: exports.mockRef,
    determineVersion: exports.mockDetermineVersion,
    generateSemanticVersion: exports.mockGenerateSemanticVersion,
    generateTagVersion: exports.mockGenerateTagVersion,
    parseSemanticVersion: exports.mockParseSemanticVersion,
    fetch: exports.mockFetch,
    getVersionDescription: exports.mockGetVersionDescription,
    isDirty: exports.mockIsDirty,
    getTag: exports.mockGetTag,
    hasAnyVersionTags: exports.mockHasAnyVersionTags,
    getTotalNumberOfCommits: exports.mockGetTotalNumberOfCommits,
    git: exports.mockGit,
};
