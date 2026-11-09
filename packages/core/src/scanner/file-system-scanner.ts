import { Logger } from '@axisparkjs/logger';
import { Scanner } from './scanner';
import { ScannerOptions } from './scanner-options';
import fg from 'fast-glob';

/**
 * The glob patterns of the files loaded by default by the `FileSystemScanner`.
 */
export const DEFAULT_SCANNER_INCLUDE: readonly string[] = ['**/*.{js,ts}'];

/**
 * The glob patterns of the files always ignored by the `FileSystemScanner`. The `exclude` option adds patterns to this list.
 */
export const DEFAULT_SCANNER_EXCLUDE: readonly string[] = [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/*.d.ts',
    '**/*.bootstrap.{js,ts}',
    '**/*.spec.{js,ts}',
    '**/*.test.{js,ts}'
];

/**
 * A scanner implementation that scans the file system for JavaScript and TypeScript files. The `FileSystemScanner` class implements the `Scanner` interface and provides functionality to scan the file system starting from a specified root directory. It uses the `fast-glob` library to perform file matching based on specified patterns, allowing for efficient scanning of files while ignoring certain directories and file types.
 *
 * The `FileSystemScanner` class has a constructor that accepts four optional parameters: `root`, which specifies the root directory to start scanning from (defaulting to the current working directory), `importer`, which is a function used to import the discovered files (defaulting to dynamic import), `options`, which configures the `include` and `exclude` glob patterns, and `logger`, which logs the loaded files at `debug` and `trace` levels. The `scan` method initiates the scanning process, retrieves the matching files, and imports them using the provided importer function.
 */
export class FileSystemScanner implements Scanner {
    constructor(
        private readonly root = process.cwd(),
        private readonly importer: (file: string) => Promise<unknown> = (file) => import(file),
        private readonly options: ScannerOptions = {},
        private readonly logger?: Logger
    ) {}

    /**
     * Scans the file system for the files that match the `include` patterns and none of the exclusions, starting from the specified root directory, and imports them.
     */
    public async scan(): Promise<void> {
        const files = await fg([...(this.options.include ?? DEFAULT_SCANNER_INCLUDE)], {
            cwd: this.root,
            absolute: true,
            ignore: [...DEFAULT_SCANNER_EXCLUDE, ...(this.options.exclude ?? [])]
        });

        const logger = this.logger?.child('Scanner');
        await logger?.debug(`Loading ${files.length} files from ${this.root}`, { root: this.root, files: files.length });
        for (const file of files) await logger?.trace(`Loading ${file}`, { file });

        await Promise.all(files.map((file) => this.importer(file)));
    }
}
