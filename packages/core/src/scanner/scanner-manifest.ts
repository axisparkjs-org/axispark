import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { ScannerOptions } from './scanner-options';

/** The name of the module manifest read by default by the `FileSystemScanner`, in the `basePath` of the application. */
export const SCANNER_MANIFEST_FILE = 'axispark.manifest.json';

/** The glob patterns of the files loaded by default by the `FileSystemScanner`. */
export const DEFAULT_SCANNER_INCLUDE: readonly string[] = ['**/*.{js,ts}'];

/** The glob patterns of the files always ignored by the `FileSystemScanner`. The `exclude` option adds patterns to this list. */
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
 * The module manifest of an application: the files that the `FileSystemScanner` imports, relative to the `basePath`, so it does not search
 * the file system when the application starts.
 */
export interface ScannerManifest {
    /** The version of the format of the manifest. */
    version: 1;
    /** The files to import, relative to the `basePath`, with `/` separators. */
    files: string[];
}

/**
 * Searches the files that the `FileSystemScanner` loads from a folder, with the same patterns.
 * @param root The base path of the application.
 * @param options The `include` and `exclude` patterns of the scanner.
 * @returns The absolute paths of the files, sorted.
 */
export async function findScannerFiles(root: string, options: Pick<ScannerOptions, 'include' | 'exclude'> = {}): Promise<string[]> {
    const files = await fg([...(options.include ?? DEFAULT_SCANNER_INCLUDE)], {
        cwd: root,
        absolute: true,
        ignore: [...DEFAULT_SCANNER_EXCLUDE, ...(options.exclude ?? [])]
    });
    return files.sort();
}

/**
 * Creates the module manifest of an application with the files found by the scanner patterns.
 * @param root The base path of the application, usually the folder of the compiled code.
 * @param options The `include` and `exclude` patterns of the scanner, which must be the ones of the application.
 * @returns The manifest.
 */
export async function createScannerManifest(root: string, options: Pick<ScannerOptions, 'include' | 'exclude'> = {}): Promise<ScannerManifest> {
    const files = await findScannerFiles(root, options);
    return { version: 1, files: files.map((file) => path.relative(root, file).split(path.sep).join('/')) };
}

/**
 * Creates the module manifest of an application and writes it in its base path, for the build of the application (`axispark manifest`).
 * @param root The base path of the application, usually the folder of the compiled code.
 * @param options The `include` and `exclude` patterns of the scanner, and the `manifest` file (`axispark.manifest.json` by default).
 * @returns The path of the manifest and the manifest.
 */
export async function writeScannerManifest(root: string, options: ScannerOptions = {}): Promise<{ file: string; manifest: ScannerManifest }> {
    const manifest = await createScannerManifest(root, options);
    const file = path.resolve(root, options.manifest || SCANNER_MANIFEST_FILE);
    await writeFile(file, JSON.stringify(manifest, null, 4) + '\n');
    return { file, manifest };
}

/**
 * Reads the module manifest of an application.
 * @param root The base path of the application.
 * @param manifest The file of the manifest, relative to the base path, or `false` to not read it.
 * @returns The absolute paths of the files of the manifest, or `undefined` when there is no manifest.
 * @throws {Error} When the manifest exists but it is not a valid manifest.
 */
export async function readScannerManifest(root: string, manifest: string | false = SCANNER_MANIFEST_FILE): Promise<string[] | undefined> {
    if (manifest === false) return undefined;

    const file = path.resolve(root, manifest);
    let content: string;
    try {
        content = await readFile(file, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }

    const parsed = JSON.parse(content) as Partial<ScannerManifest>;
    if (parsed.version !== 1 || !Array.isArray(parsed.files) || parsed.files.some((entry) => typeof entry !== 'string')) {
        throw new Error(`The module manifest ${file} is not valid: generate it again with "axispark manifest"`);
    }
    return parsed.files.map((entry) => path.resolve(root, entry));
}
