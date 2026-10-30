# `@axisparkjs/cli`

Command-line interface to scaffold new AxiSpark.js projects from ready-to-run TypeScript templates.

The complete guide is in the [CLI documentation](https://axisparkjs.com/docs/getting-started/cli).

## What the package does

- Provides the `axispark create` command to generate a new project in a new directory.
- Downloads one of the official templates: `default`, `http`, `http-security`, `scheduler` or `http-openapi`.
- Aligns every `@axisparkjs/*` dependency of the generated project with the CLI version.
- Optionally installs the project dependencies with npm.

## Install and use

```bash
npm install -g @axisparkjs/cli
```

Create a project interactively, or pass every option to skip the questions:

```bash
axispark create my-app --template http --install
cd my-app
npm run dev
```

| Argument / Option | Description |
| --- | --- |
| `[name]` | Project name and directory to create. Asked if omitted. |
| `-t, --template <template>` | Template to use. A list is shown if omitted. |
| `-i, --install` / `--no-install` | Install, or skip installing, the dependencies. Asked if omitted. |
