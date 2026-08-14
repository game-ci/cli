# Test Workflow Engine

Service for YAML-based test suite definitions, taxonomy filtering, and structured test results.

Suite files can now define reusable filter presets and runs can compose them:

```yaml
name: pull-request

filterSets:
  smoke:
    categories:
      include: [Smoke]
      exclude: [Quarantined]
      taxonomy:
        Maturity: [Trusted]
        Scope: [Unit, Integration]
    names:
      regex: ['^Gameplay\\.']

runs:
  - name: fast
    editMode: true
    filterRefs: [smoke]
    filters:
      categories:
        taxonomy:
          FeedbackSpeed: [Fast]
```

Orchestrator can inject overlays into every run with:

- `testFilterRefs`
- `testFilterInjection`
- `testFilterInjectionPath`

`categories` compile to Unity `-testCategory`. `names` compile to Unity `-testFilter`.
