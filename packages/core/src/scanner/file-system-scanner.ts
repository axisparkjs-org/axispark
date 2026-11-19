import { Logger } from '@axisparkjs/logger';
import { Scanner } from './scanner';
import { ScannerOptions } from './scanner-options';
import { findScannerFiles, readScannerManifest } from './scanner-manifest';

/**
 * A scanner implementation that scans the file system for JavaScript and TypeScript files. The `FileSystemScanner` class implements the `Scanner` interface and provides functionality to scan the file system starting from a specified root directory. It uses the `fast-glob` library to perform file matching based on specified patterns, allowing for efficient scanning of files while ignoring certain directories and file types.
 *
 * When the base path has a module manifest (`axispark.manifest.json` by default, see the `manifest` option), generated in the build with
 * `axispark manifest`, the scanner imports the files of the manifest instead of searching the file system, which makes the cold starts
 * faster, especially in containers and serverless platforms.
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
     * Imports the files of the module manifest when it exists or, otherwise, scans the file system for the files that match the `include` patterns and none of the exclusions, starting from the specified root directory, and imports them.
     */
    public async scan(): Promise<void> {
        const manifest = await readScannerManifest(this.root, this.options.manifest);
        const files = manifest ?? (await findScannerFiles(this.root, this.options));

        const logger = this.logger?.child('Scanner');
        const source = manifest ? 'the module manifest of ' : '';
        await logger?.debug(`Loading ${files.length} files from ${source}${this.root}`, { root: this.root, files: files.length, manifest: !!manifest });
        for (const file of files) await logger?.trace(`Loading ${file}`, { file });

        await Promise.all(files.map((file) => this.importer(file)));
    }
}
