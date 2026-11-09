import { Response } from 'express';
import { Readable } from 'stream';
import { ExpressHttpResponse } from './express-http-response';

describe('ExpressHttpResponse', () => {
    let response: jest.Mocked<Partial<Response>>;
    let httpResponse: ExpressHttpResponse;

    beforeEach(() => {
        response = {
            status: jest.fn(),
            setHeader: jest.fn(),
            cookie: jest.fn(),
            clearCookie: jest.fn(),
            json: jest.fn(),
            send: jest.fn(),
            sendFile: jest.fn(),
            end: jest.fn(),
            headersSent: false
        };

        httpResponse = new ExpressHttpResponse(response as Response);
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

            expect(response.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
            expect(result).toBe(httpResponse);
        });
    });

    describe('cookie', () => {
        it('should set a cookie and return itself', () => {
            const result = httpResponse.cookie('token', 'abc123', { httpOnly: true });

            expect(response.cookie).toHaveBeenCalledWith('token', 'abc123', { httpOnly: true });
            expect(result).toBe(httpResponse);
        });

        it('should set a cookie with default options when options are not provided', () => {
            const result = httpResponse.cookie('token', 'abc123');

            expect(response.cookie).toHaveBeenCalledWith('token', 'abc123', {});
            expect(result).toBe(httpResponse);
        });
    });

    describe('clearCookie', () => {
        it('should clear a cookie and return itself', () => {
            const result = httpResponse.clearCookie('token', { path: '/' });

            expect(response.clearCookie).toHaveBeenCalledWith('token', { path: '/' });
            expect(result).toBe(httpResponse);
        });

        it('should clear a cookie with default options when options are not provided', () => {
            const result = httpResponse.clearCookie('token');

            expect(response.clearCookie).toHaveBeenCalledWith('token', {});
            expect(result).toBe(httpResponse);
        });
    });

    describe('json', () => {
        it('should send a json response', () => {
            const body = { id: 1 };

            httpResponse.json(body);

            expect(response.json).toHaveBeenCalledWith(body);
        });

        it('should send an empty json response', () => {
            httpResponse.json();

            expect(response.json).toHaveBeenCalledWith(undefined);
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
        it('should pipe the stream to the response', () => {
            const stream = {
                pipe: jest.fn()
            } as unknown as Readable;

            httpResponse.stream(stream);

            expect(stream.pipe).toHaveBeenCalledWith(response);
        });
    });

    describe('end', () => {
        it('should end the response', () => {
            httpResponse.end();

            expect(response.end).toHaveBeenCalled();
        });
    });

    describe('isCommitted', () => {
        it('should return true when headers have been sent', () => {
            response.headersSent = true;

            expect(httpResponse.isCommitted()).toBe(true);
        });

        it('should return false when headers have not been sent', () => {
            response.headersSent = false;

            expect(httpResponse.isCommitted()).toBe(false);
        });
    });
});
