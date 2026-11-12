import { mkdir, rm, cp, mkdtemp } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import tar from 'tar';

import { downloadTemplate } from './template';

jest.mock('node:fs/promises', () => ({
    mkdir: jest.fn(),
    rm: jest.fn(),
    cp: jest.fn(),
    mkdtemp: jest.fn()
}));

jest.mock('node:fs', () => ({
    createWriteStream: jest.fn()
}));

jest.mock('node:stream', () => ({
    Readable: {
        fromWeb: jest.fn()
    }
}));

jest.mock('node:stream/promises', () => ({
    pipeline: jest.fn()
}));

jest.mock('tar', () => ({
    x: jest.fn()
}));

const mockedMkdtemp = mkdtemp as jest.MockedFunction<typeof mkdtemp>;

const mockedMkdir = mkdir as jest.MockedFunction<typeof mkdir>;

const mockedRm = rm as jest.MockedFunction<typeof rm>;

const mockedCp = cp as jest.MockedFunction<typeof cp>;

const mockedCreateWriteStream = createWriteStream as jest.MockedFunction<typeof createWriteStream>;

const mockedFromWeb = Readable.fromWeb as jest.MockedFunction<typeof Readable.fromWeb>;

const mockedPipeline = pipeline as jest.MockedFunction<typeof pipeline>;

const mockedTarX = tar.x as jest.MockedFunction<typeof tar.x>;

describe('downloadTemplate', () => {
    const tempDirectory = '/tmp/axispark-test';
    const destination = '/projects/my-project';
    const template = 'basic';

    const archivePath = '/tmp/axispark-test/templates.tar.gz';

    const extractDirectory = '/tmp/axispark-test/extracted';

    const remoteTemplatePath = '/tmp/axispark-test/extracted/axispark-main/templates/basic';

    const localTemplatePath = path.join(__dirname, '..', '..', '..', '..', 'templates', template);

    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        jest.clearAllMocks();

        process.env.NODE_ENV = 'production';

        mockedMkdtemp.mockResolvedValue(tempDirectory);

        mockedMkdir.mockResolvedValue(undefined);

        mockedRm.mockResolvedValue(undefined);

        mockedCp.mockResolvedValue(undefined);

        mockedPipeline.mockResolvedValue(undefined);

        mockedTarX.mockResolvedValue(undefined as any);

        mockedFromWeb.mockReturnValue({} as any);

        mockedCreateWriteStream.mockReturnValue({} as any);

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            body: {}
        });
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    describe('temporary directory', () => {
        it('creates a temporary directory', async () => {
            await downloadTemplate(template, destination);

            expect(mockedMkdtemp).toHaveBeenCalledWith(expect.stringContaining(`${path.sep}axispark-`));
        });

        it('uses the generated temporary directory', async () => {
            await downloadTemplate(template, destination);

            expect(mockedMkdir).toHaveBeenCalledWith(extractDirectory);

            expect(mockedCp).toHaveBeenCalledWith(remoteTemplatePath, destination, {
                recursive: true
            });
        });

        it('propagates mkdtemp errors', async () => {
            const error = new Error('Unable to create temporary directory');

            mockedMkdtemp.mockRejectedValueOnce(error);

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Unable to create temporary directory');

            expect(mockedRm).not.toHaveBeenCalled();
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('remote template download', () => {
        it('downloads the templates archive from GitHub', async () => {
            await downloadTemplate(template, destination);

            expect(global.fetch).toHaveBeenCalledTimes(1);

            expect(global.fetch).toHaveBeenCalledWith('https://github.com/axisparkjs-org/axispark/archive/refs/heads/main.tar.gz');
        });

        it('uses the response body to create a readable stream', async () => {
            const body = {};

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                body
            });

            await downloadTemplate(template, destination);

            expect(mockedFromWeb).toHaveBeenCalledTimes(1);
            expect(mockedFromWeb).toHaveBeenCalledWith(body);
        });

        it('creates the archive write stream', async () => {
            await downloadTemplate(template, destination);

            expect(mockedCreateWriteStream).toHaveBeenCalledWith(archivePath);
        });

        it('pipes the response into the archive file', async () => {
            const readable = {};
            const writeStream = {};

            mockedFromWeb.mockReturnValue(readable as any);

            mockedCreateWriteStream.mockReturnValue(writeStream as any);

            await downloadTemplate(template, destination);

            expect(mockedPipeline).toHaveBeenCalledTimes(1);
            expect(mockedPipeline).toHaveBeenCalledWith(readable, writeStream);
        });

        it('creates the extraction directory', async () => {
            await downloadTemplate(template, destination);

            expect(mockedMkdir).toHaveBeenCalledWith(extractDirectory);
        });

        it('extracts the downloaded archive', async () => {
            await downloadTemplate(template, destination);

            expect(mockedTarX).toHaveBeenCalledTimes(1);

            expect(mockedTarX).toHaveBeenCalledWith({
                file: archivePath,
                cwd: extractDirectory
            });
        });

        it('copies the selected template after extraction', async () => {
            await downloadTemplate(template, destination);

            expect(mockedCp).toHaveBeenCalledWith(remoteTemplatePath, destination, {
                recursive: true
            });
        });
    });

    describe('HTTP response errors', () => {
        it('throws when the response is not ok', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 404,
                body: {}
            });

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Failed to download templates: 404');

            expect(mockedFromWeb).not.toHaveBeenCalled();
            expect(mockedPipeline).not.toHaveBeenCalled();
            expect(mockedMkdir).not.toHaveBeenCalled();
            expect(mockedTarX).not.toHaveBeenCalled();
            expect(mockedCp).not.toHaveBeenCalled();
        });

        it('throws when the response has no body', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                body: null
            });

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Failed to download templates: 200');

            expect(mockedFromWeb).not.toHaveBeenCalled();
            expect(mockedPipeline).not.toHaveBeenCalled();
            expect(mockedCp).not.toHaveBeenCalled();
        });

        it('throws when the response is not ok even if it has no body', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
                body: null
            });

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Failed to download templates: 500');
        });
    });

    describe('archive extraction', () => {
        it('does not extract before the archive has been written', async () => {
            const calls: string[] = [];

            mockedPipeline.mockImplementation(async () => {
                calls.push('pipeline');
            });

            mockedTarX.mockImplementation(async () => {
                calls.push('tar');
                return undefined as any;
            });

            await downloadTemplate(template, destination);

            expect(calls).toEqual(['pipeline', 'tar']);
        });

        it('does not copy before extraction succeeds', async () => {
            mockedTarX.mockRejectedValueOnce(new Error('Extraction failed'));

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Extraction failed');

            expect(mockedCp).not.toHaveBeenCalled();
        });

        it('uses the selected template name in the extracted path', async () => {
            const selectedTemplate = 'http';

            await downloadTemplate(selectedTemplate, destination);

            expect(mockedCp).toHaveBeenCalledWith(path.join(extractDirectory, 'axispark-main', 'templates', selectedTemplate), destination, {
                recursive: true
            });
        });
    });

    describe('copy', () => {
        it('copies the template recursively', async () => {
            await downloadTemplate(template, destination);

            expect(mockedCp).toHaveBeenCalledWith(remoteTemplatePath, destination, {
                recursive: true
            });
        });

        it('propagates copy errors', async () => {
            const error = new Error('Failed to copy template');

            mockedCp.mockRejectedValueOnce(error);

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Failed to copy template');
        });
    });

    describe('pipeline errors', () => {
        it('propagates pipeline errors', async () => {
            const error = new Error('Failed to write archive');

            mockedPipeline.mockRejectedValueOnce(error);

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Failed to write archive');

            expect(mockedTarX).not.toHaveBeenCalled();
            expect(mockedCp).not.toHaveBeenCalled();
        });
    });

    describe('mkdir errors', () => {
        it('propagates extraction directory creation errors', async () => {
            const error = new Error('Failed to create extraction directory');

            mockedMkdir.mockRejectedValueOnce(error);

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Failed to create extraction directory');

            expect(mockedTarX).not.toHaveBeenCalled();
            expect(mockedCp).not.toHaveBeenCalled();
        });
    });

    describe('tar errors', () => {
        it('propagates extraction errors', async () => {
            const error = new Error('Extraction failed');

            mockedTarX.mockRejectedValueOnce(error);

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Extraction failed');

            expect(mockedCp).not.toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        it('removes the temporary directory after success', async () => {
            await downloadTemplate(template, destination);

            expect(mockedRm).toHaveBeenCalledTimes(1);

            expect(mockedRm).toHaveBeenCalledWith(tempDirectory, {
                recursive: true,
                force: true
            });
        });

        it('removes the temporary directory when fetch fails', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Network error');

            expect(mockedRm).toHaveBeenCalledWith(tempDirectory, {
                recursive: true,
                force: true
            });
        });

        it('removes the temporary directory when the response is invalid', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 404,
                body: {}
            });

            await expect(downloadTemplate(template, destination)).rejects.toThrow();

            expect(mockedRm).toHaveBeenCalledWith(tempDirectory, {
                recursive: true,
                force: true
            });
        });

        it('removes the temporary directory when pipeline fails', async () => {
            mockedPipeline.mockRejectedValueOnce(new Error('Pipeline failed'));

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Pipeline failed');

            expect(mockedRm).toHaveBeenCalledWith(tempDirectory, {
                recursive: true,
                force: true
            });
        });

        it('removes the temporary directory when extraction fails', async () => {
            mockedTarX.mockRejectedValueOnce(new Error('Extraction failed'));

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Extraction failed');

            expect(mockedRm).toHaveBeenCalledWith(tempDirectory, {
                recursive: true,
                force: true
            });
        });

        it('removes the temporary directory when copying fails', async () => {
            mockedCp.mockRejectedValueOnce(new Error('Copy failed'));

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Copy failed');

            expect(mockedRm).toHaveBeenCalledWith(tempDirectory, {
                recursive: true,
                force: true
            });
        });

        it('forces recursive removal of the temporary directory', async () => {
            await downloadTemplate(template, destination);

            expect(mockedRm).toHaveBeenCalledWith(tempDirectory, {
                recursive: true,
                force: true
            });
        });

        it('attempts cleanup exactly once', async () => {
            await downloadTemplate(template, destination);

            expect(mockedRm).toHaveBeenCalledTimes(1);
        });
    });

    describe('test environment', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'test';
        });

        it('does not fetch the remote repository in test mode', async () => {
            await downloadTemplate(template, destination);

            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('does not create an archive in test mode', async () => {
            await downloadTemplate(template, destination);

            expect(mockedCreateWriteStream).not.toHaveBeenCalled();
            expect(mockedFromWeb).not.toHaveBeenCalled();
            expect(mockedPipeline).not.toHaveBeenCalled();
        });

        it('does not extract an archive in test mode', async () => {
            await downloadTemplate(template, destination);

            expect(mockedMkdir).not.toHaveBeenCalled();
            expect(mockedTarX).not.toHaveBeenCalled();
        });

        it('copies directly from the local templates directory', async () => {
            await downloadTemplate(template, destination);

            expect(mockedCp).toHaveBeenCalledWith(localTemplatePath, destination, {
                recursive: true
            });
        });

        it('still cleans up the temporary directory in test mode', async () => {
            await downloadTemplate(template, destination);

            expect(mockedRm).toHaveBeenCalledWith(tempDirectory, {
                recursive: true,
                force: true
            });
        });

        it('cleans up when local template copying fails', async () => {
            mockedCp.mockRejectedValueOnce(new Error('Local copy failed'));

            await expect(downloadTemplate(template, destination)).rejects.toThrow('Local copy failed');

            expect(mockedRm).toHaveBeenCalledWith(tempDirectory, {
                recursive: true,
                force: true
            });
        });
    });

    describe('different destinations', () => {
        it.each(['/projects/app', '/tmp/project', '/workspace/my-app', './my-project'])('copies the template to destination "%s"', async (target) => {
            await downloadTemplate(template, target);

            expect(mockedCp).toHaveBeenCalledWith(remoteTemplatePath, target, {
                recursive: true
            });
        });
    });

    describe('different templates', () => {
        it.each(['basic', 'http', 'custom-template', 'default'])('uses template "%s" in the extracted path', async (selectedTemplate) => {
            await downloadTemplate(selectedTemplate, destination);

            expect(mockedCp).toHaveBeenCalledWith(path.join(extractDirectory, 'axispark-main', 'templates', selectedTemplate), destination, {
                recursive: true
            });
        });
    });
});
