import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
  type Mocked,
} from 'vitest';
import fs from 'node:fs';
import { TestFilterResolutionService } from './test-filter-resolution-service';
import { TestSuiteParser } from './test-suite-parser';
import { TaxonomyFilterService } from './taxonomy-filter-service';
import { TestResultReporter } from './test-result-reporter';
import { TestWorkflowService } from './test-workflow-service';
import {
  ResolvedTestFilter,
  TestSuiteDefinition,
  TestResult,
  TestRunDefinition,
} from './test-workflow-types';

vi.mock('node:fs');
vi.mock('@actions/core');

const mockFs = fs as Mocked<typeof fs>;

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// Test Suite Parser
// ============================================================================

describe('TestSuiteParser', () => {
  describe('parseSuiteFile', () => {
    it('should parse a valid YAML suite file', () => {
      const yaml = `
name: pull-request
description: Fast feedback for pull requests
runs:
  - name: fast
    editMode: true
    filters:
      Maturity: Trusted
      FeedbackSpeed: Fast,Moderate
    timeout: 300
  - name: basic
    needs: [fast]
    editMode: true
    playMode: true
    filters:
      Maturity: Trusted,Adolescent
    timeout: 600
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml);

      const suite = TestSuiteParser.parseSuiteFile('/path/to/suite.yml');

      expect(suite.name).toBe('pull-request');
      expect(suite.description).toBe('Fast feedback for pull requests');
      expect(suite.runs).toHaveLength(2);
      expect(suite.runs[0].name).toBe('fast');
      expect(suite.runs[0].editMode).toBe(true);
      expect(suite.runs[0].filters?.Maturity).toBe('Trusted');
      expect(suite.runs[0].timeout).toBe(300);
      expect(suite.runs[1].needs).toEqual(['fast']);
    });

    it('should parse preset-based filters and run references', () => {
      const yaml = `
name: pull-request
filterSets:
  smoke:
    categories:
      include: [Smoke]
      taxonomy:
        Maturity: [Trusted]
    names:
      regex: ['^Gameplay\\\\.']
runs:
  - name: fast
    editMode: true
    filterRefs: [smoke]
    filters:
      categories:
        exclude: [Quarantined]
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml);

      const suite = TestSuiteParser.parseSuiteFile('/path/to/suite.yml');

      expect(suite.filterSets?.smoke.categories?.include).toEqual(['Smoke']);
      expect(suite.filterSets?.smoke.categories?.taxonomy?.Maturity).toEqual(['Trusted']);
      expect(suite.runs[0].filterRefs).toEqual(['smoke']);
      expect((suite.runs[0].filters as any).categories.exclude).toEqual(['Quarantined']);
    });

    it('should throw when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => TestSuiteParser.parseSuiteFile('/missing.yml')).toThrow('not found');
    });

    it('should throw on invalid YAML', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('not: valid: yaml: [');

      expect(() => TestSuiteParser.parseSuiteFile('/bad.yml')).toThrow();
    });

    it('should throw when suite has no name', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('runs:\n  - name: test\n    editMode: true');

      expect(() => TestSuiteParser.parseSuiteFile('/no-name.yml')).toThrow("'name'");
    });

    it('should throw when suite has no runs', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('name: test');

      expect(() => TestSuiteParser.parseSuiteFile('/no-runs.yml')).toThrow("'runs'");
    });

    it('should throw on invalid needs reference', () => {
      const yaml = `
name: bad-deps
runs:
  - name: first
    editMode: true
    needs: [nonexistent]
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml);

      expect(() => TestSuiteParser.parseSuiteFile('/bad-deps.yml')).toThrow(
        "unknown run 'nonexistent'",
      );
    });
  });

  describe('resolveRunOrder', () => {
    it('should return single group when no dependencies exist', () => {
      const suite: TestSuiteDefinition = {
        name: 'test',
        runs: [
          { name: 'a', editMode: true },
          { name: 'b', playMode: true },
        ],
      };

      const groups = TestSuiteParser.resolveRunOrder(suite);
      expect(groups).toHaveLength(1);
      expect(groups[0]).toHaveLength(2);
    });

    it('should resolve linear dependencies into sequential groups', () => {
      const suite: TestSuiteDefinition = {
        name: 'test',
        runs: [
          { name: 'a', editMode: true },
          { name: 'b', needs: ['a'], playMode: true },
          { name: 'c', needs: ['b'], editMode: true },
        ],
      };

      const groups = TestSuiteParser.resolveRunOrder(suite);
      expect(groups).toHaveLength(3);
      expect(groups[0][0].name).toBe('a');
      expect(groups[1][0].name).toBe('b');
      expect(groups[2][0].name).toBe('c');
    });

    it('should place independent runs in the same group', () => {
      const suite: TestSuiteDefinition = {
        name: 'test',
        runs: [
          { name: 'root', editMode: true },
          { name: 'branch-a', needs: ['root'], playMode: true },
          { name: 'branch-b', needs: ['root'], editMode: true },
        ],
      };

      const groups = TestSuiteParser.resolveRunOrder(suite);
      expect(groups).toHaveLength(2);
      expect(groups[0]).toHaveLength(1);
      expect(groups[1]).toHaveLength(2);
    });

    it('should detect circular dependencies', () => {
      const suite: TestSuiteDefinition = {
        name: 'circular',
        runs: [
          { name: 'a', needs: ['b'], editMode: true },
          { name: 'b', needs: ['a'], playMode: true },
        ],
      };

      expect(() => TestSuiteParser.resolveRunOrder(suite)).toThrow('Circular dependency');
    });

    it('should detect three-way circular dependencies', () => {
      const suite: TestSuiteDefinition = {
        name: 'circular3',
        runs: [
          { name: 'a', needs: ['c'], editMode: true },
          { name: 'b', needs: ['a'], playMode: true },
          { name: 'c', needs: ['b'], editMode: true },
        ],
      };

      expect(() => TestSuiteParser.resolveRunOrder(suite)).toThrow('Circular dependency');
    });
  });

  describe('validateSuite', () => {
    it('should return no errors for a valid suite', () => {
      const suite: TestSuiteDefinition = {
        name: 'valid',
        runs: [
          { name: 'a', editMode: true },
          { name: 'b', needs: ['a'], playMode: true },
        ],
      };

      const errors = TestSuiteParser.validateSuite(suite);
      expect(errors).toHaveLength(0);
    });

    it('should detect duplicate run names', () => {
      const suite: TestSuiteDefinition = {
        name: 'dupes',
        runs: [
          { name: 'a', editMode: true },
          { name: 'a', playMode: true },
        ],
      };

      const errors = TestSuiteParser.validateSuite(suite);
      expect(errors.some((e) => e.includes('Duplicate'))).toBe(true);
    });

    it('should detect missing test mode', () => {
      const suite: TestSuiteDefinition = {
        name: 'no-mode',
        runs: [{ name: 'empty' }],
      };

      const errors = TestSuiteParser.validateSuite(suite);
      expect(errors.some((e) => e.includes('editMode'))).toBe(true);
    });

    it('should detect self-dependency', () => {
      const suite: TestSuiteDefinition = {
        name: 'self-dep',
        runs: [{ name: 'a', needs: ['a'], editMode: true }],
      };

      const errors = TestSuiteParser.validateSuite(suite);
      expect(errors.some((e) => e.includes('depends on itself'))).toBe(true);
    });
  });
});

// ============================================================================
// Taxonomy Filter Service
// ============================================================================

describe('TaxonomyFilterService', () => {
  describe('loadTaxonomy', () => {
    it('should return built-in dimensions when no file provided', () => {
      const dimensions = TaxonomyFilterService.loadTaxonomy();

      expect(dimensions.length).toBeGreaterThanOrEqual(7);
      expect(dimensions.find((d) => d.name === 'Scope')).toBeDefined();
      expect(dimensions.find((d) => d.name === 'Maturity')).toBeDefined();
      expect(dimensions.find((d) => d.name === 'FeedbackSpeed')).toBeDefined();
      expect(dimensions.find((d) => d.name === 'Execution')).toBeDefined();
      expect(dimensions.find((d) => d.name === 'Rigor')).toBeDefined();
      expect(dimensions.find((d) => d.name === 'Determinism')).toBeDefined();
      expect(dimensions.find((d) => d.name === 'IsolationLevel')).toBeDefined();
    });

    it('should merge custom dimensions from file', () => {
      const yaml = `
extensible_groups:
  - name: SubjectLevel
    values: [Class, Feature, System, Product]
  - name: DataScenario
    values: [HappyPath, EdgeCase]
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml);

      const dimensions = TaxonomyFilterService.loadTaxonomy('/taxonomy.yml');

      expect(dimensions.find((d) => d.name === 'SubjectLevel')).toBeDefined();
      expect(dimensions.find((d) => d.name === 'DataScenario')).toBeDefined();
      // Built-ins should still exist
      expect(dimensions.find((d) => d.name === 'Scope')).toBeDefined();
    });

    it('should merge values for existing dimensions', () => {
      const yaml = `
extensible_groups:
  - name: Scope
    values: [Unit, Integration, Acceptance]
`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml);

      const dimensions = TaxonomyFilterService.loadTaxonomy('/taxonomy.yml');
      const scope = dimensions.find((d) => d.name === 'Scope');

      expect(scope).toBeDefined();
      // Should contain built-in + custom values without duplicates
      expect(scope!.values).toContain('Unit');
      expect(scope!.values).toContain('Integration');
      expect(scope!.values).toContain('Acceptance');
      expect(scope!.values).toContain('System');
    });
  });

  describe('buildFilterArgs', () => {
    it('should return no args for empty filters', () => {
      const filter: ResolvedTestFilter = {
        categories: { include: [], exclude: [] },
        names: { include: [], exclude: [] },
      };
      expect(TaxonomyFilterService.buildFilterArgs(filter)).toEqual([]);
    });

    it('should build category args', () => {
      const filter: ResolvedTestFilter = {
        categories: { include: ['Maturity=Trusted'], exclude: [] },
        names: { include: [], exclude: [] },
      };
      const result = TaxonomyFilterService.buildFilterArgs(filter);
      expect(result).toEqual(['-testCategory "Maturity=Trusted"']);
    });

    it('should build included and excluded category args', () => {
      const filter: ResolvedTestFilter = {
        categories: { include: ['Smoke', 'Maturity=Trusted'], exclude: ['Quarantined'] },
        names: { include: [], exclude: [] },
      };
      const result = TaxonomyFilterService.buildFilterArgs(filter);
      expect(result).toEqual(['-testCategory "Smoke;Maturity=Trusted;!Quarantined"']);
    });

    it('should build name and regex filters via testFilter', () => {
      const filter: ResolvedTestFilter = {
        categories: { include: [], exclude: [] },
        names: {
          include: ['Gameplay.FastSuite', '^Gameplay\\.Combat\\.'],
          exclude: ['Flaky.Test'],
        },
      };
      const result = TaxonomyFilterService.buildFilterArgs(filter);
      expect(result).toEqual([
        '-testFilter "Gameplay.FastSuite;^Gameplay\\.Combat\\.;!Flaky.Test"',
      ]);
    });

    it('should emit both category and name filters when present', () => {
      const filter: ResolvedTestFilter = {
        categories: { include: ['Smoke'], exclude: [] },
        names: { include: ['Gameplay.FastSuite'], exclude: [] },
      };
      const result = TaxonomyFilterService.buildFilterArgs(filter);
      expect(result).toEqual(['-testCategory "Smoke"', '-testFilter "Gameplay.FastSuite"']);
    });
  });

  describe('matchesFilter', () => {
    it('should match exact value', () => {
      const match = TaxonomyFilterService.matchesFilter(
        { Scope: 'Unit', Maturity: 'Trusted' },
        { Scope: 'Unit' },
      );
      expect(match).toBe(true);
    });

    it('should match comma-separated values', () => {
      const match = TaxonomyFilterService.matchesFilter(
        { Scope: 'Integration' },
        { Scope: 'Unit,Integration' },
      );
      expect(match).toBe(true);
    });

    it('should not match when value is not in list', () => {
      const match = TaxonomyFilterService.matchesFilter(
        { Scope: 'End To End' },
        { Scope: 'Unit,Integration' },
      );
      expect(match).toBe(false);
    });

    it('should require all dimensions to match (AND)', () => {
      const match = TaxonomyFilterService.matchesFilter(
        { Scope: 'Unit', Maturity: 'Experimental' },
        { Scope: 'Unit', Maturity: 'Trusted' },
      );
      expect(match).toBe(false);
    });

    it('should match regex patterns', () => {
      const match = TaxonomyFilterService.matchesFilter(
        { Maturity: 'Trusted' },
        { Maturity: '/Trusted|Adolescent/' },
      );
      expect(match).toBe(true);
    });

    it('should not match when regex does not match', () => {
      const match = TaxonomyFilterService.matchesFilter(
        { Maturity: 'Experimental' },
        { Maturity: '/Trusted|Adolescent/' },
      );
      expect(match).toBe(false);
    });

    it('should return false when test lacks a required dimension', () => {
      const match = TaxonomyFilterService.matchesFilter({}, { Scope: 'Unit' });
      expect(match).toBe(false);
    });

    it('should handle hierarchical dot-notation matching', () => {
      const match = TaxonomyFilterService.matchesFilter(
        { Domain: 'Combat.Melee.Sword' },
        { Domain: 'Combat.Melee' },
      );
      expect(match).toBe(true);
    });
  });
});

describe('TestFilterResolutionService', () => {
  it('should resolve preset refs, run filters, and injected filters together', () => {
    const suite: TestSuiteDefinition = {
      name: 'suite',
      filterSets: {
        smoke: {
          categories: {
            include: ['Smoke'],
            taxonomy: { Maturity: ['Trusted'] },
          },
        },
      },
      runs: [
        {
          name: 'fast',
          editMode: true,
          filterRefs: ['smoke'],
          filters: {
            categories: {
              taxonomy: { Scope: ['Unit'] },
            },
          },
        },
      ],
    };

    const resolved = TestFilterResolutionService.resolveForRun(suite, suite.runs[0], {
      filters: {
        categories: { exclude: ['Quarantined'] },
        names: { regex: ['^Gameplay\\.'] },
      },
    });

    expect(resolved.categories.include).toEqual(['Smoke', 'Maturity=Trusted', 'Scope=Unit']);
    expect(resolved.categories.exclude).toEqual(['Quarantined']);
    expect(resolved.names.include).toEqual(['^Gameplay\\.']);
  });

  it('should parse injection documents', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(`
refs: [smoke]
filters:
  categories:
    exclude: [Quarantined]
`);

    const parsed = TestFilterResolutionService.parseInjection('', '/filters.yml');

    expect(parsed?.refs).toEqual(['smoke']);
    expect(parsed).toBeDefined();
    expect(((parsed as any).filters as any).categories.exclude).toEqual(['Quarantined']);
  });
});

// ============================================================================
// Test Result Reporter
// ============================================================================

describe('TestResultReporter', () => {
  describe('parseJUnitXml', () => {
    it('should parse a valid JUnit XML string', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="EditMode" tests="10" failures="2" skipped="1" time="5.432">
  <testcase classname="MyTests" name="TestA">
  </testcase>
  <testcase classname="MyTests" name="TestB">
    <failure message="Expected true">
      <![CDATA[at MyTests.TestB() in TestFile.cs:42]]>
    </failure>
  </testcase>
</testsuite>`;

      const result = TestResultReporter.parseJUnitXml(xml);

      expect(result.runName).toBe('EditMode');
      expect(result.passed).toBe(7);
      expect(result.failed).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.duration).toBeCloseTo(5.432);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].testName).toBe('TestB');
      expect(result.failures[0].className).toBe('MyTests');
      expect(result.failures[0].message).toBe('Expected true');
      expect(result.failures[0].stackTrace).toContain('TestFile.cs:42');
    });

    it('should handle empty test suite', () => {
      const xml = `<testsuite name="Empty" tests="0" failures="0" time="0.0"></testsuite>`;

      const result = TestResultReporter.parseJUnitXml(xml);
      expect(result.passed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.failures).toHaveLength(0);
    });
  });

  describe('parseJsonData', () => {
    it('should parse Unity JSON test result data', () => {
      const data = {
        name: 'PlayMode',
        passed: 15,
        failed: 2,
        skipped: 3,
        duration: 12.5,
        testResults: [
          { name: 'FailingTest', className: 'MyClass', result: 'Failed', message: 'Assert failed' },
        ],
      };

      const result = TestResultReporter.parseJsonData(data);
      expect(result.runName).toBe('PlayMode');
      expect(result.passed).toBe(15);
      expect(result.failed).toBe(2);
      expect(result.skipped).toBe(3);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].testName).toBe('FailingTest');
    });
  });

  describe('generateSummary', () => {
    it('should generate a markdown summary table', () => {
      const results: TestResult[] = [
        {
          runName: 'fast',
          passed: 10,
          failed: 0,
          skipped: 2,
          duration: 5.0,
          failures: [],
        },
        {
          runName: 'basic',
          passed: 20,
          failed: 1,
          skipped: 0,
          duration: 30.0,
          failures: [{ testName: 'TestX', className: 'ClassX', message: 'Expected 1 but got 2' }],
        },
      ];

      const summary = TestResultReporter.generateSummary(results);

      expect(summary).toContain('Test Results Summary');
      expect(summary).toContain('fast');
      expect(summary).toContain('basic');
      expect(summary).toContain('Total');
      expect(summary).toContain('Failures');
      expect(summary).toContain('TestX');
    });

    it('should return message when no results available', () => {
      const summary = TestResultReporter.generateSummary([]);
      expect(summary).toContain('No test results');
    });
  });

  describe('writeResults', () => {
    it('should create output directory and write files for json format', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined as any);
      mockFs.writeFileSync.mockReturnValue(undefined);

      const results: TestResult[] = [
        { runName: 'test', passed: 5, failed: 0, skipped: 0, duration: 1.0, failures: [] },
      ];

      TestResultReporter.writeResults(results, '/output', 'json');

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/output', { recursive: true });
      // Should write JSON + summary
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
    });

    it('should write both formats when specified', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockReturnValue(undefined);

      const results: TestResult[] = [
        { runName: 'test', passed: 5, failed: 0, skipped: 0, duration: 1.0, failures: [] },
      ];

      TestResultReporter.writeResults(results, '/output', 'both');

      // Should write JSON + JUnit XML + summary = 3 calls
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(3);
    });
  });
});

// ============================================================================
// Test Workflow Service - buildUnityArgs
// ============================================================================

describe('TestWorkflowService', () => {
  describe('buildUnityArgs', () => {
    const suite: TestSuiteDefinition = {
      name: 'suite',
      runs: [],
    };
    const baseParams = {
      projectPath: '/project',
      targetPlatform: 'StandaloneLinux64',
      testResultPath: './test-results',
      testResultFormat: 'junit',
    } as any;

    it('should build EditMode args', () => {
      const run: TestRunDefinition = { name: 'edit', editMode: true };

      const args = TestWorkflowService.buildUnityArgs(suite, run, baseParams);

      expect(args).toContain('-batchmode');
      expect(args).toContain('-nographics');
      expect(args).toContain('-runTests');
      expect(args).toContain('-testPlatform EditMode');
      expect(args).toContain('-projectPath');
    });

    it('should build PlayMode args', () => {
      const run: TestRunDefinition = { name: 'play', playMode: true };

      const args = TestWorkflowService.buildUnityArgs(suite, run, baseParams);

      expect(args).toContain('-testPlatform PlayMode');
    });

    it('should build built-client args', () => {
      const run: TestRunDefinition = {
        name: 'client',
        builtClient: true,
        builtClientPath: './Builds/Linux',
      };

      const args = TestWorkflowService.buildUnityArgs(suite, run, baseParams);

      expect(args).toContain('-testPlatform StandalonePlayer');
      expect(args).toContain('-builtPlayerPath');
      expect(args).toContain('./Builds/Linux');
    });

    it('should include taxonomy filter args', () => {
      const run: TestRunDefinition = {
        name: 'filtered',
        editMode: true,
        filters: { Maturity: 'Trusted', Scope: 'Unit,Integration' },
      };

      const args = TestWorkflowService.buildUnityArgs(suite, run, baseParams);

      expect(args).toContain('-testCategory');
      expect(args).toContain('Maturity=Trusted');
      expect(args).toContain('Scope=Unit');
      expect(args).toContain('Scope=Integration');
    });

    it('should include injected preset and inline filters', () => {
      const suiteWithPresets: TestSuiteDefinition = {
        name: 'suite',
        filterSets: {
          smoke: {
            categories: {
              include: ['Smoke'],
            },
          },
        },
        runs: [],
      };
      const run: TestRunDefinition = {
        name: 'filtered',
        editMode: true,
        filterRefs: ['smoke'],
      };

      const args = TestWorkflowService.buildUnityArgs(suiteWithPresets, run, baseParams, {
        filters: {
          categories: { exclude: ['Quarantined'] },
          names: { include: ['Gameplay.FastSuite'] },
        },
      });

      expect(args).toContain('-testCategory "Smoke;!Quarantined"');
      expect(args).toContain('-testFilter "Gameplay.FastSuite"');
    });

    it('should include build target', () => {
      const run: TestRunDefinition = { name: 'test', editMode: true };

      const args = TestWorkflowService.buildUnityArgs(suite, run, baseParams);

      expect(args).toContain('-buildTarget StandaloneLinux64');
    });
  });
});
