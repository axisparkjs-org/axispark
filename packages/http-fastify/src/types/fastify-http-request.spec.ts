import { FastifyRequest } from 'fastify';
import { BadRequestError, FileUploadDefinition, FileUploadLimitError } from '@axisparkjs/http';
import { FastifyHttpRequest } from './fastify-http-request';

describe('FastifyHttpRequest', () => {
    let request: jest.Mocked<Partial<FastifyRequest>>;
    let httpRequest: FastifyHttpRequest;

    beforeEach(() => {
        request = {
            method: 'POST',
            url: '/api/users/1?active=true',
            headers: {
                authorization: 'Bearer token',
                'content-type': 'application/json'
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
            }
        } as jest.Mocked<Partial<FastifyRequest>>;

        httpRequest = new FastifyHttpRequest(request as FastifyRequest);
    });

    it('should return the request method', () => {
        expect(httpRequest.method).toBe(request.method);
    });

    it('should return the request path', () => {
        expect(httpRequest.path).toBe(request.url);
    });

    it('should return the request url', () => {
        expect(httpRequest.url).toBe(request.url);
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
        expect(httpRequest.cookies).toBe(request.cookies);
    });

    it('should return a cookie value', () => {
        expect(httpRequest.getCookie('sessionId')).toBe('abc123');
    });

    it('should return undefined when the cookie does not exist', () => {
        expect(httpRequest.getCookie('nonexistent')).toBeUndefined();
    });

    describe('getHeader', () => {
        it('should return a header value', () => {
            expect(httpRequest.getHeader('content-type')).toBe('application/json');
        });

        it('should return an array header value', () => {
            request.headers = {
                'x-test': ['a', 'b']
            };

            expect(httpRequest.getHeader('x-test')).toEqual(['a', 'b']);
        });

        it('should return undefined when the header does not exist', () => {
            expect(httpRequest.getHeader('x-test')).toBeUndefined();
        });

        it('should be case insensitive', () => {
            expect(httpRequest.getHeader('Content-Type')).toBe('application/json');
        });
    });

    describe('parseMultipart', () => {
        const definition = new FileUploadDefinition(1024, 2, ['text/plain']);

        const filePart = (fieldname: string, filename: string, mimetype: string, content: string) => ({
            type: 'file',
            fieldname,
            filename,
            mimetype,
            file: { resume: jest.fn() },
            toBuffer: jest.fn().mockResolvedValue(Buffer.from(content))
        });
        const fieldPart = (fieldname: string, value: unknown) => ({ type: 'field', fieldname, value });

        const withParts = (...parts: unknown[]) => {
            const multipartRequest = request as unknown as Record<string, jest.Mock>;
            multipartRequest.isMultipart = jest.fn().mockReturnValue(true);
            multipartRequest.parts = jest.fn(async function* () {
                for (const part of parts) {
                    if (part instanceof Error) throw part;
                    yield part;
                }
            });
            return multipartRequest;
        };

        it('should do nothing when the request is not multipart', async () => {
            await httpRequest.parseMultipart(definition);
            (request as unknown as Record<string, jest.Mock>).isMultipart = jest.fn().mockReturnValue(false);
            await httpRequest.parseMultipart(definition);

            expect(httpRequest.files).toBeUndefined();
            expect(httpRequest.body).toEqual({ name: 'John' });
        });

        it('should expose files and text fields', async () => {
            const multipartRequest = withParts(
                fieldPart('name', 'Jane'),
                fieldPart('tags', 'a'),
                fieldPart('tags', 2),
                filePart('avatar', 'avatar.txt', 'text/plain', 'hello')
            );

            await httpRequest.parseMultipart(definition);

            expect(multipartRequest.parts).toHaveBeenCalledWith({ limits: { fileSize: 1024, files: 2 } });
            expect(httpRequest.body).toEqual({ name: 'Jane', tags: ['a', '2'] });
            expect(httpRequest.files).toEqual([
                { fieldName: 'avatar', originalName: 'avatar.txt', mimeType: 'text/plain', size: 5, buffer: Buffer.from('hello') }
            ]);
        });

        it('should reject files with a MIME type that is not allowed', async () => {
            const part = filePart('avatar', 'avatar.png', 'image/png', 'png');
            withParts(part);

            await expect(httpRequest.parseMultipart(definition)).rejects.toEqual(new FileUploadLimitError('mimeType', 1));
            expect(part.file.resume).toHaveBeenCalled();
            expect(httpRequest.files).toBeUndefined();
        });

        it('should report zero allowed MIME types when the definition rejects without a list', async () => {
            withParts(filePart('avatar', 'avatar.png', 'image/png', 'png'));
            const rejecting = Object.assign(new FileUploadDefinition(1024, 2), { isMimeTypeAllowed: () => false });

            await expect(httpRequest.parseMultipart(rejecting)).rejects.toEqual(new FileUploadLimitError('mimeType', 0));
        });

        it.each([
            ['FST_REQ_FILE_TOO_LARGE', new FileUploadLimitError('fileSize', 1024)],
            ['FST_FILES_LIMIT', new FileUploadLimitError('files', 2)]
        ])('should translate %s into a limit error', async (code, expected) => {
            withParts(Object.assign(new Error(code), { code }));

            await expect(httpRequest.parseMultipart(definition)).rejects.toEqual(expected);
        });

        it('should translate other parsing errors into a bad request', async () => {
            withParts(Object.assign(new Error('bad'), { code: 'FST_PROTO_VIOLATION' }));

            await expect(httpRequest.parseMultipart(definition)).rejects.toBeInstanceOf(BadRequestError);
        });
    });
});
