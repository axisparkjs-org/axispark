import { access, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function directoryExists(directory: string): Promise<boolean> {
    try {
        await access(directory);
        return true;
    } catch {
        return false;
    }
}

/** Removes a directory and its content. Does nothing when the directory does not exist. */
export async function removeDirectory(directory: string): Promise<void> {
    await rm(directory, { recursive: true, force: true });
}

export async function updatePackageJson(projectPath: string, projectName: string): Promise<void> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const content = await readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(content);

    const ownPackageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const ownContent = await readFile(ownPackageJsonPath, 'utf8');
    const ownPackageJson = JSON.parse(ownContent);

    packageJson.name = projectName;

    for (const section of ['dependencies', 'devDependencies']) {
        const dependencies = packageJson[section];

        if (!dependencies) continue;

        for (const dependency of Object.keys(dependencies)) {
            if (dependency.startsWith('@axisparkjs/')) {
                dependencies[dependency] = ownPackageJson.version;
            }
        }
    }

    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 4) + '\n');
}
