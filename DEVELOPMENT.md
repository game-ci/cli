# Development

## Prerequisites

- Deno installed on your machine
- Deno plugin installed, formatter enabled on save

## Setup

None

## Usage

This is how you can use the CLI during development.

```bash
deno run -A ./src/index.ts
```

Example commands:

- `deno run -A ./src/index.ts build ./test-project`
- `deno run -A ./src/index.ts config open`

## Tasks

Common commands:

- `deno task lint` to check formatting
- `deno task test` to run tests
- `deno task coverage` to run tests with coverage

See `deno.json` for the full list of tasks.
