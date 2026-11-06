/**
 * Options for configuring the files loaded by the `FileSystemScanner`.
 *
 * The patterns are [fast-glob](https://github.com/mrmlnc/fast-glob) patterns relative to the `basePath` of the application.
 *
 * Example usage:
 *
 * ```typescript
 * AxiSparkFactory.create({
 *     basePath: __dirname,
 *     scanner: { exclude: ['**\/scripts/**', '**\/app-*.ts'] }
 * });
 * ```
 */
export interface ScannerOptions {
    /**
     * Glob patterns of the files to load. Defaults to `['**\/*.{js,ts}']`.
     */
    include?: string[];

    /**
     * Glob patterns of the files to ignore. They are added to the default exclusions, which ignore the `node_modules`, `dist` and `coverage`
     * folders, the declaration files (`*.d.ts`), the bootstrap files (`*.bootstrap.{js,ts}`) and the test files (`*.spec.{js,ts}` and `*.test.{js,ts}`).
     */
    exclude?: string[];
}
