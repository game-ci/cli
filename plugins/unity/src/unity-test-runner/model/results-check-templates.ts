// Source of truth is ../views/*.hbs — keep both in sync if the templates change.
// Inlined (rather than read from disk via Action.actionFolder) because these
// two tiny templates have no reason to depend on runtime path resolution: a
// bundled/compiled game-ci binary doesn't preserve the plugin's own
// src/**/dist/ staging layout that Action.actionFolder assumes, so a
// filesystem lookup for them is fragile in exactly the context these run in
// (see game-ci/unity-test-runner#310's CI - all matrix jobs failed with an
// ENOENT for results-check-summary.hbs once the wrapper stopped shipping its
// own dist/ alongside the compiled action code).
export const RESULTS_CHECK_SUMMARY_TEMPLATE = `{{#runs}}
  ###
  {{summary}}
{{/runs}}
`;

export const RESULTS_CHECK_DETAILS_TEMPLATE = `{{#runs}}

  <details><summary>{{summary}}</summary>

    {{#suites}}
      *
      {{summary}}
      {{#tests}}
        *
        {{summary}}
        {{#if annotation}}
          {{#if annotation.message}}
            {{indent annotation.message}}
          {{/if}}
          {{#if annotation.raw_details}}
            {{indent annotation.raw_details}}
          {{/if}}
        {{/if}}
      {{/tests}}
    {{/suites}}

  </details>

{{/runs}}
`;
