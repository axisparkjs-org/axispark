# Contributing to AxiSpark.js

We welcome contributions to AxiSpark.js! Whether you're fixing bugs, adding new features, or improving documentation, your help is greatly appreciated. Please follow the guidelines below to ensure a smooth contribution process. Here are some ways you can contribute:

## Found a Bug?

If you encounter a bug, please submit an issue on our GitHub repository. Provide as much detail as possible, including steps to reproduce the bug, expected behavior, and any relevant screenshots or error messages. Here is the link to our [GitHub Issues](https://github.com/axisparkjs/axispark/issues) page.

Please, when opening a new issue, choose the **Fix** template from the [new issue page](https://github.com/axisparkjs/axispark/issues/new/choose). The template sets the `[Fix]` title prefix and the `bug` label, and asks for the information we need to understand and address the problem.

## Missing a Feature?

You can also submit a feature request on our GitHub repository. Please describe the feature you would like to see, how it would benefit users, and any relevant use cases. Here is the link to our [GitHub Issues](https://github.com/axisparkjs/axispark/issues) page.

Please, when opening a new feature request, choose the **Feature** template from the [new issue page](https://github.com/axisparkjs/axispark/issues/new/choose). This will help us understand the feature better and prioritize it accordingly.

## Improving Existing Code or Documentation?

Use the **Update** template for improvements to existing code, tooling or configuration, and the **Docs** template for documentation changes. Both are available on the [new issue page](https://github.com/axisparkjs/axispark/issues/new/choose).

## Submitting a Pull Request for a Bug or Feature

### Development Setup

You need to set up your development environment to contribute code. First, you need [Node.js](https://nodejs.org/) version 24 or higher. Follow these steps:
- Fork the repository on GitHub.
- Clone your forked repository to your local machine.
- Install the necessary dependencies using `npm ci`. If you are modifying docs, you need to install web dependencies using `npm run docs:ci`.

### Branching

For each issue, create a new branch from the `main` branch. Start the branch name with the prefix that matches the issue type, followed by a brief description:

| Issue type | Branch prefix | Example |
| --- | --- | --- |
| `[Feature]` | `feature/` | `feature/http-file-upload` |
| `[Fix]` | `fix/` | `fix/login-validation` |
| `[Update]` | `update/` | `update/translate-cli-comments` |
| `[Docs]` | `docs/` | `docs/cli-page` |

`release/` branches are reserved for maintainers to prepare releases.

Make sure to regularly pull the latest changes from the `main` branch to keep your branch up to date.

### Versioning

When submitting a change, you need to run a changeset before committing your changes. This will generate a changeset file that describes the change you made. The changeset file will be used to update the version of the package when your pull request is merged.

You would run `npm run cd:changeset` and select the type of change you are making:
- "Patch" option if you are fixing a bug
- "Minor" option if you are adding a new feature
- "Major" option if you are making a breaking change

### Commit Messages

When committing your changes, please use clear and descriptive commit messages. Follow this specification for consistency:

The commit message should start with the type of change (e.g., `fix`, `feat`, `update`, `docs`, `refactor`, etc.) followed by ` (#issue-number): ` and a brief description of the change. Here are some examples:
- `fix (#123): Correct the login validation logic`
- `feat (#456): Add new user profile feature`

### Pull Request Guidelines

When you are ready to submit your changes, create a pull request (PR) from your branch to the `main` branch of the original repository. The description is prefilled with the [pull request template](.github/pull_request_template.md): link the issue, list the changes and complete the checklist (changeset, tests and documentation).

Once your pull request is submitted, it will pass CI pipeline and be reviewed by the maintainers. Please be responsive to any feedback or requests for changes. We appreciate your contributions and look forward to collaborating with you!

### Need to test your package before submitting a pull request?

There is a pipeline that builds a snapshot of your branch and publishes it to GitHub Packages. You can use this snapshot to test your changes in another project before submitting a pull request. To do this, follow these steps:

1. Make sure your branch contains a changeset (`npm run cd:changeset`). Without a changeset, no snapshot version is generated.
2. Push your branch to the repository. Snapshots can be published from `feature/`, `fix/`, `update/` and `docs/` branches.
3. Open the [CD workflow](https://github.com/axisparkjs/axispark/actions/workflows/cd.yml), click **Run workflow**, select your branch and the `snapshot` environment.
4. When the workflow finishes, the **Show snapshot information** step prints the npm tag of the snapshot. The tag is the branch name without its prefix, with invalid characters replaced by `-`. For example, `fix/login-validation` is published with the `login-validation` tag.
5. In the project where you want to test the snapshot, configure the GitHub Packages registry for the `@axisparkjs` scope in its `.npmrc` file. You need a GitHub [personal access token](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages) with the `read:packages` scope:

    ```
    @axisparkjs:registry=https://npm.pkg.github.com
    //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
    ```

6. Install the snapshot of each package you need using its tag:

    ```bash
    GITHUB_TOKEN=<your-token> npm install @axisparkjs/<package>@<tag>
    ```

If you don't have permission to run the pipeline, please contact the maintainers to request access.