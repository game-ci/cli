import fs from 'node:fs';
import YAML from 'yaml';
import {
  LegacyTaxonomyFilters,
  ResolvedTestFilter,
  TestFilterDefinition,
  TestFilterInjectionDefinition,
  TestRunDefinition,
  TestSuiteDefinition,
} from './test-workflow-types';

/**
 * Resolves suite filter presets, run-local filters, and orchestrator-injected
 * overlays into the concrete Unity category/name filters for one run.
 */
export class TestFilterResolutionService {
  static resolveForRun(
    suite: TestSuiteDefinition,
    run: TestRunDefinition,
    injection?: TestFilterInjectionDefinition,
  ): ResolvedTestFilter {
    const presetCatalog = {
      ...suite.filterSets,
      ...injection?.filterSets,
    };

    const refs = [...(run.filterRefs || []), ...(injection?.refs || [])];
    let resolved: ResolvedTestFilter = TestFilterResolutionService.empty();

    for (const ref of refs) {
      const preset = presetCatalog[ref];
      if (!preset) {
        throw new Error(`Unknown test filter preset '${ref}' on run '${run.name}'`);
      }
      resolved = TestFilterResolutionService.mergeResolved(
        resolved,
        TestFilterResolutionService.resolveDefinition(presetCatalog, preset, new Set([ref])),
      );
    }

    resolved = TestFilterResolutionService.mergeResolved(
      resolved,
      TestFilterResolutionService.normalize(run.filters),
    );

    resolved = TestFilterResolutionService.mergeResolved(
      resolved,
      TestFilterResolutionService.normalize(injection?.filters),
    );

    return resolved;
  }

  static parseInjection(
    raw?: string,
    filePath?: string,
  ): TestFilterInjectionDefinition | undefined {
    const merged: TestFilterInjectionDefinition = {};
    let hasContent = false;

    if (filePath) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Injected test filter file not found: ${filePath}`);
      }
      Object.assign(
        merged,
        TestFilterResolutionService.parseRawInjection(fs.readFileSync(filePath, 'utf8')),
      );
      hasContent = true;
    }

    if (raw && raw.trim() !== '') {
      Object.assign(merged, TestFilterResolutionService.parseRawInjection(raw));
      hasContent = true;
    }

    return hasContent ? merged : undefined;
  }

  private static parseRawInjection(raw: string): TestFilterInjectionDefinition {
    const parsed = YAML.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Injected test filter must be a YAML/JSON object');
    }

    const injection: TestFilterInjectionDefinition = {};

    if (parsed.refs !== undefined) {
      if (!Array.isArray(parsed.refs)) {
        throw new Error(`Injected test filter 'refs' must be an array`);
      }
      injection.refs = parsed.refs.map((value: unknown) => String(value));
    }

    if (parsed.filters !== undefined) {
      injection.filters = parsed.filters as LegacyTaxonomyFilters | TestFilterDefinition;
    }

    if (parsed.filterSets !== undefined) {
      if (typeof parsed.filterSets !== 'object' || Array.isArray(parsed.filterSets)) {
        throw new Error(`Injected test filter 'filterSets' must be an object`);
      }
      injection.filterSets = parsed.filterSets as Record<string, TestFilterDefinition>;
    }

    return injection;
  }

  private static resolveDefinition(
    presetCatalog: Record<string, TestFilterDefinition>,
    definition: TestFilterDefinition,
    stack: Set<string>,
  ): ResolvedTestFilter {
    let resolved = TestFilterResolutionService.empty();

    for (const ref of definition.extends || []) {
      const preset = presetCatalog[ref];
      if (!preset) {
        throw new Error(`Unknown test filter preset '${ref}'`);
      }
      if (stack.has(ref)) {
        throw new Error(
          `Circular test filter preset reference detected: ${Array.from(stack).join(' -> ')} -> ${ref}`,
        );
      }
      const nextStack = new Set(stack);
      nextStack.add(ref);
      resolved = TestFilterResolutionService.mergeResolved(
        resolved,
        TestFilterResolutionService.resolveDefinition(presetCatalog, preset, nextStack),
      );
    }

    return TestFilterResolutionService.mergeResolved(
      resolved,
      TestFilterResolutionService.normalize(definition),
    );
  }

  static normalize(input?: LegacyTaxonomyFilters | TestFilterDefinition): ResolvedTestFilter {
    if (!input) {
      return TestFilterResolutionService.empty();
    }

    if (TestFilterResolutionService.isLegacyFilters(input)) {
      const categories = Object.entries(input).flatMap(([dimension, valueSpec]) =>
        TestFilterResolutionService.normalizeTaxonomyEntry(dimension, valueSpec),
      );

      return {
        categories: {
          include: TestFilterResolutionService.unique(categories),
          exclude: [],
        },
        names: {
          include: [],
          exclude: [],
        },
      };
    }

    const categories = input.categories || {};
    const names = input.names || {};
    const taxonomy = categories.taxonomy || {};

    return {
      categories: {
        include: TestFilterResolutionService.unique([
          ...(categories.include || []).map(String),
          ...Object.entries(taxonomy).flatMap(([dimension, valueSpec]) =>
            TestFilterResolutionService.normalizeTaxonomyEntry(dimension, valueSpec),
          ),
        ]),
        exclude: TestFilterResolutionService.unique((categories.exclude || []).map(String)),
      },
      names: {
        include: TestFilterResolutionService.unique([
          ...(names.include || []).map(String),
          ...(names.regex || []).map(String),
        ]),
        exclude: TestFilterResolutionService.unique((names.exclude || []).map(String)),
      },
    };
  }

  private static normalizeTaxonomyEntry(dimension: string, valueSpec: string | string[]): string[] {
    const values = Array.isArray(valueSpec)
      ? valueSpec.map(String)
      : String(valueSpec)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);

    return values.map((value) => `${dimension}=${value}`);
  }

  private static mergeResolved(
    base: ResolvedTestFilter,
    overlay: ResolvedTestFilter,
  ): ResolvedTestFilter {
    return {
      categories: {
        include: TestFilterResolutionService.unique([
          ...base.categories.include,
          ...overlay.categories.include,
        ]),
        exclude: TestFilterResolutionService.unique([
          ...base.categories.exclude,
          ...overlay.categories.exclude,
        ]),
      },
      names: {
        include: TestFilterResolutionService.unique([
          ...base.names.include,
          ...overlay.names.include,
        ]),
        exclude: TestFilterResolutionService.unique([
          ...base.names.exclude,
          ...overlay.names.exclude,
        ]),
      },
    };
  }

  private static isLegacyFilters(
    input: LegacyTaxonomyFilters | TestFilterDefinition,
  ): input is LegacyTaxonomyFilters {
    return !('categories' in input) && !('names' in input) && !('extends' in input);
  }

  private static unique(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private static empty(): ResolvedTestFilter {
    return {
      categories: { include: [], exclude: [] },
      names: { include: [], exclude: [] },
    };
  }
}
