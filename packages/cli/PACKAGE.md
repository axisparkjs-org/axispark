# `@axisparkjs/cli`

Command-line interface to scaffold new AxiSpark.js projects from ready-to-run TypeScript templates.

The complete guide is in the [CLI documentation](https://axisparkjs.com/docs/getting-started/cli).

## What the package does

- Provides the `axispark create` command to generate a new project in a new directory.
- Downloads one of the official templates: `default`, `http`, `http-security`, `scheduler` or `http-openapi`.
- Aligns every `@axisparkjs/*` dependency of the generated project with the CLI version.
- Optionally installs the project dependencies with npm.
- Provides the `axispark manifest` command to write the module manifest of a compiled application, so it does not scan the file system when it starts.

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

Write the module manifest after compiling, in the base path of the application:

```bash
tsc && axispark manifest dist
```

| Argument / Option | Description |
| --- | --- |
| `[dir]` | Base path of the compiled application. Defaults to the current folder. |
| `--include <patterns...>` / `--exclude <patterns...>` | The `scanner` patterns of the application, if it sets them. |
| `-o, --output <file>` | Manifest file, relative to the base path. Defaults to `axispark.manifest.json`. |
