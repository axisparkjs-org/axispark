import fg from 'fast-glob';
import { FileSystemScanner } from './file-system-scanner';
import { Logger } from '@axisparkjs/logger';

jest.mock('fast-glob');

const mockedFg = fg as jest.MockedFunction<typeof fg>;

const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/*.d.ts', '**/*.bootstrap.{js,ts}', '**/*.spec.{js,ts}', '**/*.test.{js,ts}'];

describe('FileSystemScanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should scan js and ts files with the expected configuration', async () => {
        mockedFg.mockResolvedValue([]);

        const importer = jest.fn().mockResolvedValue({});
        const scanner = new FileSystemScanner('/project', importer);

        await scanner.scan();

        expect(mockedFg).toHaveBeenCalledWith(['**/*.{js,ts}'], {
            cwd: '/project',
            absolute: true,
            ignore: DEFAULT_EXCLUDE
        });
    });

    it('should import every discovered file', async () => {
        mockedFg.mockResolvedValue(['/project/a.ts', '/project/b.js']);

        const importer = jest.fn().mockResolvedValue({});
        const scanner = new FileSystemScanner('/project', importer);

        await scanner.scan();

        expect(importer).toHaveBeenCalledTimes(2);
        expect(importer).toHaveBeenNthCalledWith(1, '/project/a.ts');
        expect(importer).toHaveBeenNthCalledWith(2, '/project/b.js');
    });

    it('should load the files that match the include patterns', async () => {
        mockedFg.mockResolvedValue([]);

        const scanner = new FileSystemScanner('/project', jest.fn(), { include: ['controllers/**/*.ts', 'services/**/*.ts'] });

        await scanner.scan();

        expect(mockedFg).toHaveBeenCalledWith(['controllers/**/*.ts', 'services/**/*.ts'], {
            cwd: '/project',
            absolute: true,
            ignore: DEFAULT_EXCLUDE
        });
    });

    it('should add the exclude patterns to the default exclusions', async () => {
        mockedFg.mockResolvedValue([]);

        const scanner = new FileSystemScanner('/project', jest.fn(), { exclude: ['**/scripts/**', '**/app-*.ts'] });

        await scanner.scan();

        expect(mockedFg).toHaveBeenCalledWith(['**/*.{js,ts}'], {
            cwd: '/project',
            absolute: true,
            ignore: [...DEFAULT_EXCLUDE, '**/scripts/**', '**/app-*.ts']
        });
    });

    it('should log the number of loaded files at debug level and each file at trace level', async () => {
        mockedFg.mockResolvedValue(['/project/a.ts', '/project/b.js']);

        const child = { debug: jest.fn().mockResolvedValue(undefined), trace: jest.fn().mockResolvedValue(undefined) };
        const logger = { child: jest.fn().mockReturnValue(child) } as unknown as Logger;
        const scanner = new FileSystemScanner('/project', jest.fn().mockResolvedValue({}), {}, logger);

        await scanner.scan();

        expect(logger.child).toHaveBeenCalledWith('Scanner');
        expect(child.debug).toHaveBeenCalledWith('Loading 2 files from /project', { root: '/project', files: 2 });
        expect(child.trace).toHaveBeenCalledTimes(2);
        expect(child.trace).toHaveBeenNthCalledWith(1, 'Loading /project/a.ts', { file: '/project/a.ts' });
        expect(child.trace).toHaveBeenNthCalledWith(2, 'Loading /project/b.js', { file: '/project/b.js' });
    });

    it('should propagate errors from fast-glob', async () => {
        const error = new Error('scan error');
        mockedFg.mockRejectedValue(error);

        const importer = jest.fn();
        const scanner = new FileSystemScanner('/project', importer);

        await expect(scanner.scan()).rejects.toThrow(error);

        expect(importer).not.toHaveBeenCalled();
    });

    it('should propagate errors from an imported module', async () => {
        mockedFg.mockResolvedValue(['/project/a.ts', '/project/b.ts']);

        const error = new Error('import error');

        const importer = jest.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(error);

        const scanner = new FileSystemScanner('/project', importer);

        await expect(scanner.scan()).rejects.toThrow(error);
    });

    it('should use the default importer if none is provided', async () => {
        mockedFg.mockResolvedValue(['/project/a.ts']);

        const scanner = new FileSystemScanner('/project');

        try {
            await scanner.scan();
        } catch {
            /* ignore */
        }

        expect(mockedFg).toHaveBeenCalledWith(['**/*.{js,ts}'], {
            cwd: '/project',
            absolute: true,
            ignore: DEFAULT_EXCLUDE
        });
    });
});
