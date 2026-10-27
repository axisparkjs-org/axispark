import { Parameter } from '@axisparkjs/engine';
import { Body, Header, Ip, Path, Query, Request, Response, Session, Cookie, UploadedFile, UploadedFiles } from './parameters';
import {
    RequestResolver,
    ResponseResolver,
    BodyResolver,
    PathResolver,
    QueryResolver,
    HeaderResolver,
    IpResolver,
    SessionResolver,
    CookieResolver,
    UploadedFileResolver,
    UploadedFilesResolver
} from './parameters';

jest.mock('@axisparkjs/engine', () => {
    const originalModule = jest.requireActual('@axisparkjs/engine');

    return {
        ...originalModule,
        Parameter: jest.fn()
    };
});

it.each([Body, Header, Ip, Path, Query, Request, Response, Session, Cookie, UploadedFile, UploadedFiles])('Parameter %p should be defined', (parameter) => {
    parameter('test');

    expect(parameter).toBeDefined();
    expect(parameter).toBeInstanceOf(Function);
    expect(Parameter).toHaveBeenCalled();
});

describe('ParameterResolvers', () => {
    const httpContext: any = {
        request: {
            body: { field: 'John' },
            params: {
                id: '123'
            },
            query: {
                search: 'test'
            },
            headers: {
                authorization: 'Bearer token'
            },
            ip: '127.0.0.1'
        },
        response: {
            status: jest.fn(),
            json: jest.fn()
        },
        session: {
            userId: 1
        }
    };

    describe('RequestResolver', () => {
        it('should return request', () => {
            const resolver = new RequestResolver();

            expect(resolver.resolve(httpContext)).toBe(httpContext.request);
        });
    });

    describe('ResponseResolver', () => {
        it('should return response', () => {
            const resolver = new ResponseResolver();

            expect(resolver.resolve(httpContext)).toBe(httpContext.response);
        });
    });

    describe('BodyResolver', () => {
        it('should return request body', () => {
            const resolver = new BodyResolver();

            expect(resolver.resolve(httpContext)).toEqual(httpContext.request.body);
        });
    });

    describe('ParamResolver', () => {
        it('should return parameter by field', () => {
            const resolver = new PathResolver();

            expect(resolver.resolve(httpContext, { field: 'id' } as any)).toBe('123');
        });

        it('should return undefined when parameter does not exist', () => {
            const resolver = new PathResolver();

            expect(resolver.resolve(httpContext, { field: 'unknown' } as any)).toBeUndefined();
        });
    });

    describe('QueryResolver', () => {
        it('should return query parameter by field', () => {
            const resolver = new QueryResolver();

            expect(resolver.resolve(httpContext, { field: 'search' } as any)).toBe('test');
        });

        it('should return undefined when query parameter does not exist', () => {
            const resolver = new QueryResolver();

            expect(resolver.resolve(httpContext, { field: 'missing' } as any)).toBeUndefined();
        });
    });

    describe('HeaderResolver', () => {
        it('should return header by field', () => {
            const resolver = new HeaderResolver();

            expect(resolver.resolve(httpContext, { field: 'authorization' } as any)).toBe('Bearer token');
        });

        it('should return undefined when header does not exist', () => {
            const resolver = new HeaderResolver();

            expect(resolver.resolve(httpContext, { field: 'missing' } as any)).toBeUndefined();
        });
    });

    describe('IpResolver', () => {
        it('should return request ip', () => {
            const resolver = new IpResolver();

            expect(resolver.resolve(httpContext)).toBe('127.0.0.1');
        });
    });

    describe('SessionResolver', () => {
        it('should return session', () => {
            const resolver = new SessionResolver();

            expect(resolver.resolve(httpContext)).toBe(httpContext.session);
        });
    });

    describe('CookieResolver', () => {
        it('should return cookie by field', () => {
            const resolver = new CookieResolver();

            httpContext.request.cookies = { sessionId: 'abc123' };

            expect(resolver.resolve(httpContext, { field: 'sessionId' } as any)).toBe('abc123');
        });

        it('should return undefined when cookie does not exist', () => {
            const resolver = new CookieResolver();

            httpContext.request.cookies = { sessionId: 'abc123' };

            expect(resolver.resolve(httpContext, { field: 'missing' } as any)).toBeUndefined();
        });
    });

    describe('UploadedFileResolver', () => {
        const avatar = { fieldName: 'avatar', originalName: 'a.png', mimeType: 'image/png', size: 1, buffer: Buffer.from('a') };
        const other = { ...avatar, fieldName: 'other' };

        it('should return the first file of the field', () => {
            httpContext.request.files = [other, avatar, { ...avatar, originalName: 'b.png' }];

            expect(new UploadedFileResolver().resolve(httpContext, { field: 'avatar' } as any)).toBe(avatar);
        });

        it('should return undefined when the field has no files', () => {
            httpContext.request.files = [other];

            expect(new UploadedFileResolver().resolve(httpContext, { field: 'avatar' } as any)).toBeUndefined();
        });

        it('should return undefined when the request was not parsed', () => {
            httpContext.request.files = undefined;

            expect(new UploadedFileResolver().resolve(httpContext, { field: 'avatar' } as any)).toBeUndefined();
        });
    });

    describe('UploadedFilesResolver', () => {
        const first = { fieldName: 'documents', originalName: '1.pdf', mimeType: 'application/pdf', size: 1, buffer: Buffer.from('1') };
        const second = { ...first, originalName: '2.pdf' };
        const other = { ...first, fieldName: 'other' };

        it('should return the files of the field', () => {
            httpContext.request.files = [first, other, second];

            expect(new UploadedFilesResolver().resolve(httpContext, { field: 'documents' } as any)).toEqual([first, second]);
        });

        it('should return all files when no field is given', () => {
            httpContext.request.files = [first, other];

            const files = new UploadedFilesResolver().resolve(httpContext, { field: undefined } as any);

            expect(files).toEqual([first, other]);
            expect(files).not.toBe(httpContext.request.files);
        });

        it('should return undefined when the request was not parsed', () => {
            httpContext.request.files = undefined;

            expect(new UploadedFilesResolver().resolve(httpContext, { field: 'documents' } as any)).toBeUndefined();
        });
    });
});
