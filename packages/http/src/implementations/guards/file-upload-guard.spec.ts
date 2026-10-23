import { FileUploadDefinition, FileUploadGenerator, FileUploadLimitError } from '../../file-upload';
import { HttpContext } from '../../types';
import { ContentTooLargeError, UnsupportedMediaTypeError } from '../errors';
import { FileUploadGuard } from './file-upload-guard';

describe('FileUploadGuard', () => {
    let generator: jest.Mocked<FileUploadGenerator>;
    let guard: FileUploadGuard;
    let parseMultipart: jest.Mock;

    const createContext = (overrides: { contentType?: string | string[]; parse?: jest.Mock } = {}): HttpContext => {
        const { contentType, parse } = { contentType: 'multipart/form-data; boundary=x', parse: parseMultipart, ...overrides };
        return { request: { headers: { 'content-type': contentType }, parseMultipart: parse } } as unknown as HttpContext;
    };

    beforeEach(() => {
        generator = { generate: jest.fn().mockReturnValue(new FileUploadDefinition(1024, 2, ['image/png'])) } as unknown as jest.Mocked<FileUploadGenerator>;
        parseMultipart = jest.fn().mockResolvedValue(undefined);
        guard = new FileUploadGuard(generator);
    });

    it('parses multipart requests with the generated definition', async () => {
        const context = createContext();

        await expect(guard.failedCheckFileUpload(context)).resolves.toBeUndefined();
        expect(generator.generate).toHaveBeenCalledWith(context);
        expect(parseMultipart).toHaveBeenCalledWith(generator.generate.mock.results[0].value);
    });

    it('accepts array content type headers ignoring case', async () => {
        await guard.failedCheckFileUpload(createContext({ contentType: ['Multipart/Form-Data; boundary=x'] }));

        expect(parseMultipart).toHaveBeenCalled();
    });

    it.each([['application/json'], [undefined]])('skips requests with content type %p', async (contentType) => {
        await guard.failedCheckFileUpload(createContext({ contentType }));

        expect(generator.generate).not.toHaveBeenCalled();
        expect(parseMultipart).not.toHaveBeenCalled();
    });

    it('skips requests without multipart support or an empty content type header', async () => {
        await expect(guard.failedCheckFileUpload(createContext({ parse: undefined }))).resolves.toBeUndefined();
        await expect(guard.failedCheckFileUpload(createContext({ contentType: [], parse: parseMultipart }))).resolves.toBeUndefined();

        expect(generator.generate).not.toHaveBeenCalled();
        expect(parseMultipart).not.toHaveBeenCalled();
    });

    it.each([
        ['fileSize', 1024, new ContentTooLargeError('File exceeds the maximum allowed size of 1024 bytes.')],
        ['files', 2, new ContentTooLargeError('Too many files. The maximum allowed is 2.')],
        ['mimeType', 1, new UnsupportedMediaTypeError('Unsupported file type.')]
    ] as const)('translates the %s limit into the default HTTP error', async (reason, limit, expected) => {
        parseMultipart.mockRejectedValue(new FileUploadLimitError(reason, limit));

        const promise = guard.failedCheckFileUpload(createContext());

        await expect(promise).rejects.toEqual(expected);
        await expect(promise).rejects.toBeInstanceOf(expected.constructor);
    });

    it('uses the configured message string', async () => {
        generator.generate.mockReturnValue(new FileUploadDefinition(1024, 2, undefined, 'Upload rejected'));
        parseMultipart.mockRejectedValue(new FileUploadLimitError('files', 2));

        await expect(guard.failedCheckFileUpload(createContext())).rejects.toEqual(new ContentTooLargeError('Upload rejected'));
    });

    it('uses the configured message callback with the limit and reason', async () => {
        const message = jest.fn((limit: number, reason: string) => `${reason}:${limit}`);
        generator.generate.mockReturnValue(new FileUploadDefinition(1024, 2, ['image/png'], message));
        parseMultipart.mockRejectedValue(new FileUploadLimitError('mimeType', 1));

        await expect(guard.failedCheckFileUpload(createContext())).rejects.toEqual(new UnsupportedMediaTypeError('mimeType:1'));
        expect(message).toHaveBeenCalledWith(1, 'mimeType');
    });

    it('rethrows other parsing errors', async () => {
        const error = new Error('boom');
        parseMultipart.mockRejectedValue(error);

        await expect(guard.failedCheckFileUpload(createContext())).rejects.toBe(error);
    });
});
