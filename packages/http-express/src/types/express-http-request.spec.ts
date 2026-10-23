import { Request } from 'express';
import { PassThrough } from 'node:stream';
import { BadRequestError, FileUploadDefinition, FileUploadLimitError } from '@axisparkjs/http';
import { ExpressHttpRequest } from './express-http-request';

describe('ExpressHttpRequest', () => {
    let request: jest.Mocked<Partial<Request>>;
    let httpRequest: ExpressHttpRequest;

    beforeEach(() => {
        request = {
            method: 'POST',
            path: '/users/1',
            originalUrl: '/api/users/1?active=true',
            headers: {
                authorization: 'Bearer token'
            },
            query: {
                active: 'true'
            },
            params: {
                id: '1'
            },
            body: {
                name: 'John'
            },
            ip: '127.0.0.1',
            session: {
                userId: '123'
            } as never,
            cookies: {
                sessionId: 'abc123'
            },

            get: jest.fn()
        };

        httpRequest = new ExpressHttpRequest(request as Request);
    });

    it('should return the request method', () => {
        expect(httpRequest.method).toBe(request.method);
    });

    it('should return the request path', () => {
        expect(httpRequest.path).toBe(request.path);
    });

    it('should return the original url', () => {
        expect(httpRequest.url).toBe(request.originalUrl);
    });

    it('should return the request headers', () => {
        expect(httpRequest.headers).toBe(request.headers);
    });

    it('should return the request query', () => {
        expect(httpRequest.query).toBe(request.query);
    });

    it('should return the request params', () => {
        expect(httpRequest.params).toBe(request.params);
    });

    it('should return the request body', () => {
        expect(httpRequest.body).toBe(request.body);
    });

    it('should return the request ip', () => {
        expect(httpRequest.ip).toBe(request.ip);
    });

    it('should return the request session', () => {
        expect(httpRequest.session).toBe(request.session);
    });

    it('should return the request cookies', () => {
        request.cookies = { sessionId: 'abc123' };
        expect(httpRequest.cookies).toBe(request.cookies);
    });

    it('should return a cookie value', () => {
        request.cookies = { sessionId: 'abc123' };

        expect(httpRequest.getCookie('sessionId')).toBe('abc123');
    });

    it('should return undefined when the cookie does not exist', () => {
        request.cookies = { sessionId: 'abc123' };

        expect(httpRequest.getCookie('nonexistent')).toBeUndefined();
    });

    it('should return a header value', () => {
        (request.get as jest.Mock).mockReturnValue('application/json');

        expect(httpRequest.getHeader('content-type')).toBe('application/json');
        expect(request.get).toHaveBeenCalledWith('content-type');
    });

    it('should return undefined when the header does not exist', () => {
        (request.get as jest.Mock).mockReturnValue(undefined);

        expect(httpRequest.getHeader('x-test')).toBeUndefined();
        expect(request.get).toHaveBeenCalledWith('x-test');
    });

    describe('parseMultipart', () => {
        const boundary = 'axisparkboundary';
        const definition = new FileUploadDefinition(8, 2, ['text/plain', 'application/octet-stream']);

        interface Part {
            name: string;
            value: string;
            filename?: string;
            type?: string;
        }
        const multipartBody = (parts: Part[], closed = true) =>
            parts
                .map(({ name, value, filename, type }) => {
                    const disposition = `Content-Disposition: form-data; name="${name}"${filename ? `; filename="${filename}"` : ''}`;
                    return `--${boundary}\r\n${disposition}\r\n${type ? `Content-Type: ${type}\r\n` : ''}\r\n${value}\r\n`;
                })
                .join('') + (closed ? `--${boundary}--\r\n` : '');

        const parse = (body: string, contentType = `multipart/form-data; boundary=${boundary}`, fileDefinition = definition) => {
            const stream = Object.assign(new PassThrough(), { headers: { 'content-type': contentType }, body: undefined });
            stream.end(body);
            const multipartRequest = new ExpressHttpRequest(stream as unknown as Request);
            return { multipartRequest, stream, promise: multipartRequest.parseMultipart(fileDefinition) };
        };

        it('should expose files and text fields', async () => {
            const { multipartRequest, promise } = parse(
                multipartBody([
                    { name: 'name', value: 'Jane' },
                    { name: 'tags', value: 'a' },
                    { name: 'tags', value: 'b' },
                    { name: 'avatar', value: 'hello', filename: 'avatar.txt', type: 'text/plain' },
                    { name: 'raw', value: 'bin', type: 'application/octet-stream' }
                ])
            );

            await expect(promise).resolves.toBeUndefined();
            expect(multipartRequest.body).toEqual({ name: 'Jane', tags: ['a', 'b'] });
            expect(multipartRequest.files).toEqual([
                { fieldName: 'avatar', originalName: 'avatar.txt', mimeType: 'text/plain', size: 5, buffer: Buffer.from('hello') },
                { fieldName: 'raw', originalName: '', mimeType: 'application/octet-stream', size: 3, buffer: Buffer.from('bin') }
            ]);
        });

        it('should reject files bigger than the limit', async () => {
            const { multipartRequest, promise } = parse(multipartBody([{ name: 'avatar', value: 'too large content', filename: 'a.txt', type: 'text/plain' }]));

            await expect(promise).rejects.toEqual(new FileUploadLimitError('fileSize', 8));
            expect(multipartRequest.files).toBeUndefined();
        });

        it('should reject requests with too many files', async () => {
            const file = { name: 'documents', value: 'doc', filename: 'doc.txt', type: 'text/plain' };

            await expect(parse(multipartBody([file, file, file])).promise).rejects.toEqual(new FileUploadLimitError('files', 2));
        });

        it('should reject files with a MIME type that is not allowed', async () => {
            const file = { name: 'avatar', value: 'png', filename: 'a.png', type: 'image/png' };

            await expect(parse(multipartBody([file, file])).promise).rejects.toEqual(new FileUploadLimitError('mimeType', 2));
        });

        it('should report zero allowed MIME types when the definition rejects without a list', async () => {
            const rejecting = Object.assign(new FileUploadDefinition(8, 2), { isMimeTypeAllowed: () => false });
            const body = multipartBody([{ name: 'avatar', value: 'png', filename: 'a.png', type: 'image/png' }]);

            await expect(parse(body, undefined, rejecting).promise).rejects.toEqual(new FileUploadLimitError('mimeType', 0));
        });

        it('should reject multipart requests without a boundary', async () => {
            await expect(parse('', 'multipart/form-data').promise).rejects.toBeInstanceOf(BadRequestError);
        });

        it('should reject malformed multipart bodies', async () => {
            await expect(parse(multipartBody([{ name: 'name', value: 'Jane' }], false)).promise).rejects.toBeInstanceOf(BadRequestError);
        });
    });
});
