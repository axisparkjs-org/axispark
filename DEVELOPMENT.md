# Developing AxiSpark.js

This guide covers the development workflow of the `axispark` monorepo. Before contributing, read the organization [contributing guidelines](https://github.com/axisparkjs/.github/blob/main/CONTRIBUTING.md) for issues, branching, commit messages and pull requests.

## Development Setup

You need [Node.js](https://nodejs.org/) version 24 or higher. Follow these steps:

- Fork the repository on GitHub.
- Clone your forked repository to your local machine.
- Install the necessary dependencies using `npm ci`. If you are modifying docs, you need to install web dependencies using `npm run docs:ci`.

## Versioning

When submitting a change, you need to run a changeset before committing your changes. This will generate a changeset file that describes the change you made. The changeset file will be used to update the version of the package when your pull request is merged.

You would run `npm run cd:changeset` and select the type of change you are making:

- "Patch" option if you are fixing a bug
- "Minor" option if you are adding a new feature
- "Major" option if you are making a breaking change

## Need to test your package before submitting a pull request?

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
