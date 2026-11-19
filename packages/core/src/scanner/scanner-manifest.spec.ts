import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createScannerManifest, readScannerManifest, SCANNER_MANIFEST_FILE, writeScannerManifest } from './scanner-manifest';
import { FileSystemScanner } from './file-system-scanner';

describe('scanner manifest', () => {
    let root: string;

    beforeEach(async () => {
        root = await mkdtemp(path.join(os.tmpdir(), 'axispark-manifest-'));
        await mkdir(path.join(root, 'controllers'));
        await mkdir(path.join(root, 'node_modules'));
        await writeFile(path.join(root, 'controllers', 'users.js'), '');
        await writeFile(path.join(root, 'app.js'), '');
        await writeFile(path.join(root, 'app.spec.js'), '');
        await writeFile(path.join(root, 'main.bootstrap.js'), '');
        await writeFile(path.join(root, 'scripts.js'), '');
        await writeFile(path.join(root, 'node_modules', 'dependency.js'), '');
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    it('should list the files of the scanner patterns, relative and sorted', async () => {
        await expect(createScannerManifest(root)).resolves.toEqual({ version: 1, files: ['app.js', 'controllers/users.js', 'scripts.js'] });
        await expect(createScannerManifest(root, { exclude: ['scripts.js'] })).resolves.toEqual({ version: 1, files: ['app.js', 'controllers/users.js'] });
        await expect(createScannerManifest(root, { include: ['controllers/**/*.js'] })).resolves.toEqual({ version: 1, files: ['controllers/users.js'] });
    });

    it('should write the manifest in the base path, or in the configured file', async () => {
        const { file, manifest } = await writeScannerManifest(root);

        expect(file).toBe(path.join(root, SCANNER_MANIFEST_FILE));
        expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(manifest);

        const custom = await writeScannerManifest(root, { manifest: 'modules.json' });
        expect(custom.file).toBe(path.join(root, 'modules.json'));
    });

    it('should read the absolute paths of the files of the manifest', async () => {
        await writeScannerManifest(root);

        await expect(readScannerManifest(root)).resolves.toEqual([
            path.join(root, 'app.js'),
            path.join(root, 'controllers', 'users.js'),
            path.join(root, 'scripts.js')
        ]);
    });

    it('should return undefined without manifest or when it is disabled', async () => {
        await expect(readScannerManifest(root)).resolves.toBeUndefined();
        await writeScannerManifest(root);
        await expect(readScannerManifest(root, false)).resolves.toBeUndefined();
    });

    it('should fail with an invalid manifest or a manifest that can not be read', async () => {
        await writeFile(path.join(root, SCANNER_MANIFEST_FILE), JSON.stringify({ version: 2, files: [] }));
        await expect(readScannerManifest(root)).rejects.toThrow(/is not valid: generate it again with "axispark manifest"/);

        await writeFile(path.join(root, SCANNER_MANIFEST_FILE), JSON.stringify({ version: 1, files: [1] }));
        await expect(readScannerManifest(root)).rejects.toThrow(/is not valid/);

        await expect(readScannerManifest(root, 'controllers')).rejects.toMatchObject({ code: 'EISDIR' });
    });

    it('should import the files of the manifest instead of searching the file system', async () => {
        await writeFile(path.join(root, SCANNER_MANIFEST_FILE), JSON.stringify({ version: 1, files: ['app.js'] }));
        const importer = jest.fn().mockResolvedValue(undefined);
        const child = { debug: jest.fn(), trace: jest.fn() };

        await new FileSystemScanner(root, importer, {}, { child: () => child } as any).scan();

        expect(importer).toHaveBeenCalledTimes(1);
        expect(importer).toHaveBeenCalledWith(path.join(root, 'app.js'));
        expect(child.debug).toHaveBeenCalledWith(`Loading 1 files from the module manifest of ${root}`, { root, files: 1, manifest: true });
    });

    it('should search the file system when the manifest is disabled', async () => {
        await writeFile(path.join(root, SCANNER_MANIFEST_FILE), JSON.stringify({ version: 1, files: ['app.js'] }));
        const importer = jest.fn().mockResolvedValue(undefined);

        await new FileSystemScanner(root, importer, { manifest: false }).scan();

        expect(importer).toHaveBeenCalledTimes(3);
    });
});
