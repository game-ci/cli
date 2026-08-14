export interface TestSuiteDefinition {
  name: string;
  description?: string;
  filterSets?: Record<string, TestFilterDefinition>;
  runs: TestRunDefinition[];
}

export interface TestRunDefinition {
  name: string;
  needs?: string[];
  editMode?: boolean;
  playMode?: boolean;
  builtClient?: boolean;
  builtClientPath?: string;
  filterRefs?: string[];
  filters?: LegacyTaxonomyFilters | TestFilterDefinition;
  timeout?: number;
}

export type LegacyTaxonomyFilters = Record<string, string>;

export interface TestFilterDefinition {
  extends?: string[];
  categories?: TestCategoryFilterDefinition;
  names?: TestNameFilterDefinition;
}

export interface TestCategoryFilterDefinition {
  include?: string[];
  exclude?: string[];
  taxonomy?: Record<string, string | string[]>;
}

export interface TestNameFilterDefinition {
  include?: string[];
  exclude?: string[];
  regex?: string[];
}

export interface TestFilterInjectionDefinition {
  refs?: string[];
  filters?: LegacyTaxonomyFilters | TestFilterDefinition;
  filterSets?: Record<string, TestFilterDefinition>;
}

export interface ResolvedTestFilter {
  categories: {
    include: string[];
    exclude: string[];
  };
  names: {
    include: string[];
    exclude: string[];
  };
}

export interface TaxonomyDimension {
  name: string;
  values: string[];
}

export interface TaxonomyDefinition {
  extensible_groups: TaxonomyDimension[];
}

export interface TestResult {
  runName: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: TestFailure[];
}

export interface TestFailure {
  testName: string;
  className: string;
  message: string;
  stackTrace?: string;
}
