import { FastifyReply } from 'fastify';
import { Readable } from 'stream';
import { FastifyHttpResponse } from './fastify-http-response';

describe('FastifyHttpResponse', () => {
    let response: jest.Mocked<Partial<FastifyReply>>;
    let httpResponse: FastifyHttpResponse;

    beforeEach(() => {
        response = {
            status: jest.fn(),
            header: jest.fn(),
            cookie: jest.fn(),
            clearCookie: jest.fn(),
            send: jest.fn(),
            sendFile: jest.fn(),
            sent: false
        } as unknown as jest.Mocked<Partial<FastifyReply>>;

        httpResponse = new FastifyHttpResponse(response as FastifyReply);
    });

    describe('statusCode', () => {
        it('should read the status code of the response', () => {
            (response as { statusCode?: number }).statusCode = 404;

            expect(httpResponse.statusCode).toBe(404);
        });
    });

    describe('status', () => {
        it('should set the status code and return itself', () => {
            const result = httpResponse.status(201);

            expect(response.status).toHaveBeenCalledWith(201);
            expect(result).toBe(httpResponse);
        });
    });

    describe('header', () => {
        it('should set a header and return itself', () => {
            const result = httpResponse.header('content-type', 'application/json');

            expect(response.header).toHaveBeenCalledWith('content-type', 'application/json');
            expect(result).toBe(httpResponse);
        });
    });

    describe('cookie', () => {
        it('should set a cookie and return itself', () => {
            const options = { httpOnly: true };

            const result = httpResponse.cookie('token', 'abc123', options);

            expect(response.cookie).toHaveBeenCalledWith('token', 'abc123', options);
            expect(result).toBe(httpResponse);
        });

        it('should set a cookie without options', () => {
            const result = httpResponse.cookie('token', 'abc123');

            expect(response.cookie).toHaveBeenCalledWith('token', 'abc123', undefined);
            expect(result).toBe(httpResponse);
        });
    });

    describe('clearCookie', () => {
        it('should clear a cookie and return itself', () => {
            const options = { path: '/' };

            const result = httpResponse.clearCookie('token', options);

            expect(response.clearCookie).toHaveBeenCalledWith('token', options);
            expect(result).toBe(httpResponse);
        });

        it('should clear a cookie without options', () => {
            const result = httpResponse.clearCookie('token');

            expect(response.clearCookie).toHaveBeenCalledWith('token', undefined);
            expect(result).toBe(httpResponse);
        });
    });

    describe('json', () => {
        it('should send a json response', () => {
            const body = { id: 1 };

            httpResponse.json(body);

            expect(response.send).toHaveBeenCalledWith(body);
        });

        it('should send an empty json response', () => {
            httpResponse.json();

            expect(response.send).toHaveBeenCalledWith(undefined);
        });
    });

    describe('send', () => {
        it('should send the response body', () => {
            httpResponse.send('hello');

            expect(response.send).toHaveBeenCalledWith('hello');
        });

        it('should send an empty response', () => {
            httpResponse.send();

            expect(response.send).toHaveBeenCalledWith(undefined);
        });
    });

    describe('file', () => {
        it('should send a file', () => {
            httpResponse.file('/tmp/file.txt');

            expect(response.sendFile).toHaveBeenCalledWith('/tmp/file.txt');
        });
    });

    describe('stream', () => {
        it('should send the stream', () => {
            const stream = new Readable({
                read() {}
            });

            httpResponse.stream(stream);

            expect(response.send).toHaveBeenCalledWith(stream);
        });
    });

    describe('end', () => {
        it('should send an empty response', () => {
            httpResponse.end();

            expect(response.send).toHaveBeenCalledWith();
        });
    });

    describe('isCommitted', () => {
        it('should return true when the response has been sent', () => {
            response.sent = true;

            expect(httpResponse.isCommitted()).toBe(true);
        });

        it('should return false when the response has not been sent', () => {
            response.sent = false;

            expect(httpResponse.isCommitted()).toBe(false);
        });
    });
});
