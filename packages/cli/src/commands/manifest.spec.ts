import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadProjectCore, manifestCommand } from './manifest';

describe('manifest command', () => {
    let project: string;
    let cwd: string;

    const installPackage = async (name: string, source: string) => {
        const folder = path.join(project, 'node_modules', ...name.split('/'));
        await mkdir(folder, { recursive: true });
        await writeFile(path.join(folder, 'package.json'), JSON.stringify({ name, main: 'index.js' }));
        await writeFile(path.join(folder, 'index.js'), source);
    };

    beforeEach(async () => {
        project = await realpath(await mkdtemp(path.join(os.tmpdir(), 'axispark-cli-manifest-')));
        await mkdir(path.join(project, 'lib', 'controllers'), { recursive: true });
        await writeFile(path.join(project, 'lib', 'app.js'), '');
        await writeFile(path.join(project, 'lib', 'controllers', 'users.js'), '');
        await writeFile(path.join(project, 'lib', 'app.spec.js'), '');
        cwd = process.cwd();
        process.chdir(project);
    });

    afterEach(async () => {
        process.chdir(cwd);
        jest.restoreAllMocks();
        await rm(project, { recursive: true, force: true });
    });

    it('should write the manifest of the compiled application with the scanner of @axisparkjs/core', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation();

        await manifestCommand.parseAsync(['lib'], { from: 'user' });

        const manifest = JSON.parse(await readFile(path.join(project, 'lib', 'axispark.manifest.json'), 'utf8'));
        expect(manifest).toEqual({ version: 1, files: ['app.js', 'controllers/users.js'] });
        expect(log.mock.calls[0][0]).toContain(`Module manifest written to ${path.join('lib', 'axispark.manifest.json')} with 2 files`);
    });

    it('should pass the include and exclude patterns and the output file', async () => {
        jest.spyOn(console, 'log').mockImplementation();

        await manifestCommand.parseAsync(['lib', '--include', '**/*.js', '--exclude', 'controllers/**', '-o', 'modules.json'], { from: 'user' });

        expect(JSON.parse(await readFile(path.join(project, 'lib', 'modules.json'), 'utf8'))).toEqual({ version: 1, files: ['app.js'] });
    });

    it('should load the core package from the node_modules of the project', async () => {
        await installPackage('@example/core', 'exports.writeScannerManifest = async () => ({ file: "x", manifest: { files: [] } });');

        expect(typeof loadProjectCore(path.join(project, 'lib'), '@example/core').writeScannerManifest).toBe('function');
    });

    it('should fail when the project does not have the core package', () => {
        expect(() => loadProjectCore(path.join(project, 'lib'), '@example/missing')).toThrow(
            '@example/missing was not found: run the command in a project that has it installed'
        );
    });

    it('should fail when the core package of the project can not write manifests', async () => {
        await installPackage('@example/old-core', 'exports.other = true;');

        expect(() => loadProjectCore(path.join(project, 'lib'), '@example/old-core')).toThrow(
            'The @example/old-core version of the project can not write module manifests: update it'
        );
    });
});
