import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { createRequire } from 'node:module';

/** The part of `@axisparkjs/core` used by the command: the manifest is written with the scanner of the project, so the patterns match. */
interface ScannerManifestWriter {
    writeScannerManifest(
        root: string,
        options: { include?: string[]; exclude?: string[]; manifest?: string }
    ): Promise<{ file: string; manifest: { files: string[] } }>;
}

/** The package that writes the manifests. */
export const CORE_PACKAGE = '@axisparkjs/core';

/**
 * Loads `@axisparkjs/core` from the project, so the manifest is created with the scanner patterns of the version that the project runs.
 * @param root The folder of the compiled application.
 * @param packageName The name of the core package.
 * @returns The core package of the project.
 * @throws {Error} When the project does not have `@axisparkjs/core` installed, or its version can not write manifests.
 */
export function loadProjectCore(root: string, packageName = CORE_PACKAGE): ScannerManifestWriter {
    // The require of the project resolves its own node_modules, from the folder of the application and from the working directory.
    const projectRequire = createRequire(path.join(root, 'package.json'));
    let resolved: string;
    try {
        resolved = projectRequire.resolve(packageName, { paths: [root, process.cwd()] });
    } catch {
        throw new Error(`${packageName} was not found: run the command in a project that has it installed`);
    }

    const core = projectRequire(resolved) as Partial<ScannerManifestWriter>;
    if (typeof core.writeScannerManifest !== 'function') {
        throw new Error(`The ${packageName} version of the project can not write module manifests: update it`);
    }
    return core as ScannerManifestWriter;
}

export const manifestCommand = new Command('manifest')
    .description('Write the module manifest of a compiled application, so it imports the listed files instead of scanning the file system')
    .argument('[dir]', 'base path of the compiled application (the basePath of the AxiSpark config)', '.')
    .option('--include <patterns...>', 'glob patterns of the files to load, as the scanner.include option of the application')
    .option('--exclude <patterns...>', 'glob patterns of the files to ignore, as the scanner.exclude option of the application')
    .option('-o, --output <file>', 'manifest file, relative to the base path, as the scanner.manifest option', 'axispark.manifest.json')
    .action(async (dir: string, options: { include?: string[]; exclude?: string[]; output: string }) => {
        const root = path.resolve(process.cwd(), dir);
        const core = loadProjectCore(root);
        const { file, manifest } = await core.writeScannerManifest(root, { include: options.include, exclude: options.exclude, manifest: options.output });
        console.log(chalk.green(`✓ Module manifest written to ${path.relative(process.cwd(), file) || file} with ${manifest.files.length} files`));
    });
