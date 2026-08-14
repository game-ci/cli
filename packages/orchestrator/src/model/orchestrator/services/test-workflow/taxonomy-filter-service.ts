import fs from 'node:fs';
import YAML from 'yaml';
import { ResolvedTestFilter, TaxonomyDimension, TaxonomyDefinition } from './test-workflow-types';

/**
 * Manages taxonomy dimensions and compiles resolved category/name filters into
 * Unity test runner CLI arguments.
 */
export class TaxonomyFilterService {
  /**
   * Built-in taxonomy dimensions that are always available.
   * Projects may extend these via a custom taxonomy file.
   */
  private static readonly BUILT_IN_DIMENSIONS: TaxonomyDimension[] = [
    { name: 'Scope', values: ['Unit', 'Integration', 'System', 'End To End'] },
    { name: 'Maturity', values: ['Trusted', 'Adolescent', 'Experimental'] },
    { name: 'FeedbackSpeed', values: ['Fast', 'Moderate', 'Slow'] },
    { name: 'Execution', values: ['Synchronous', 'Asynchronous', 'Coroutine'] },
    { name: 'Rigor', values: ['Strict', 'Normal', 'Relaxed'] },
    { name: 'Determinism', values: ['Deterministic', 'NonDeterministic'] },
    { name: 'IsolationLevel', values: ['Full', 'Partial', 'None'] },
  ];

  /**
   * Load taxonomy dimensions: built-in dimensions plus any custom dimensions
   * from an optional taxonomy file.
   */
  static loadTaxonomy(filePath?: string): TaxonomyDimension[] {
    const dimensions = [...TaxonomyFilterService.BUILT_IN_DIMENSIONS];

    if (filePath && fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = YAML.parse(content) as TaxonomyDefinition;

      if (parsed?.extensible_groups && Array.isArray(parsed.extensible_groups)) {
        for (const group of parsed.extensible_groups) {
          if (group.name && Array.isArray(group.values)) {
            // If a custom dimension has the same name as a built-in, merge values
            const existing = dimensions.find((d) => d.name === group.name);
            if (existing) {
              const existingValues = new Set(existing.values);
              for (const value of group.values) {
                if (!existingValues.has(value)) {
                  existing.values.push(value);
                }
              }
            } else {
              dimensions.push({ name: group.name, values: [...group.values] });
            }
          }
        }
      }
    }

    return dimensions;
  }

  /**
   * Convert resolved orchestrator filters to Unity CLI args.
   *
   * Category filters are emitted via `-testCategory`, which Unity documents as
   * the category-selection argument. Test name / regex filters are emitted via
   * `-testFilter`. Negated entries are prefixed with `!`.
   */
  static buildFilterArgs(filter: ResolvedTestFilter): string[] {
    if (!filter) {
      return [];
    }

    const args: string[] = [];
    const categoryTokens = [
      ...filter.categories.include,
      ...filter.categories.exclude.map((value) => `!${value}`),
    ];
    const nameTokens = [
      ...filter.names.include,
      ...filter.names.exclude.map((value) => `!${value}`),
    ];

    if (categoryTokens.length > 0) {
      args.push(`-testCategory "${categoryTokens.join(';')}"`);
    }

    if (nameTokens.length > 0) {
      args.push(`-testFilter "${nameTokens.join(';')}"`);
    }

    return args;
  }

  /**
   * Check if a test's taxonomy metadata matches the given filter criteria.
   *
   * A test matches if ALL filter dimensions match (AND across dimensions).
   * Within a single dimension, the test must match ANY of the specified values (OR).
   * Regex patterns are matched as regular expressions.
   * Hierarchical dot-notation supports prefix matching (e.g., filter "Combat.Melee"
   * matches test category "Combat.Melee.Sword").
   */
  static matchesFilter(
    testCategories: Record<string, string>,
    filters: Record<string, string>,
  ): boolean {
    for (const [dimension, valueSpec] of Object.entries(filters)) {
      const testValue = testCategories[dimension];

      // If the test has no value for this dimension, it does not match
      if (testValue === undefined || testValue === null) {
        return false;
      }

      if (!TaxonomyFilterService.matchesDimensionFilter(testValue, valueSpec)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a single test category value matches a dimension filter spec.
   */
  private static matchesDimensionFilter(testValue: string, valueSpec: string): boolean {
    const trimmed = valueSpec.trim();

    // Regex pattern
    if (trimmed.startsWith('/') && trimmed.endsWith('/') && trimmed.length > 2) {
      const pattern = trimmed.slice(1, -1);
      try {
        const regex = new RegExp(pattern);
        return regex.test(testValue);
      } catch {
        // Invalid regex, treat as literal
        return testValue === trimmed;
      }
    }

    // Comma-separated values
    const values = trimmed
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    return values.some((filterValue) => {
      // Exact match
      if (testValue === filterValue) {
        return true;
      }

      // Hierarchical dot-notation prefix match
      // Filter "Combat.Melee" matches test "Combat.Melee" and "Combat.Melee.Sword"
      if (filterValue.includes('.') || testValue.includes('.')) {
        if (testValue.startsWith(filterValue + '.') || testValue === filterValue) {
          return true;
        }
        // Also allow the test to be a prefix of the filter for upward matching
        if (filterValue.startsWith(testValue + '.')) {
          return true;
        }
      }

      return false;
    });
  }
}
