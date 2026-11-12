import { FastifyReply } from 'fastify';
import { PassThrough, Readable } from 'stream';
import { EventEmitter } from 'node:events';
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
            hasHeader: jest.fn().mockReturnValue(false),
            raw: new EventEmitter(),
            sent: false
        } as unknown as jest.Mocked<Partial<FastifyReply>>;

        httpResponse = new FastifyHttpResponse(response as FastifyReply);
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
        it('should send the file from its own folder, allowing the folders that start with a dot', async () => {
            (response.sendFile as jest.Mock).mockImplementation(() => (response.raw as EventEmitter).emit('finish'));

            await expect(httpResponse.file('/tmp/.folder/file.txt')).resolves.toBeUndefined();

            expect(response.sendFile).toHaveBeenCalledWith('file.txt', '/tmp/.folder', { dotfiles: 'allow', contentType: true });
        });

        it('should keep the Content-Type set before sending the file', async () => {
            (response.hasHeader as jest.Mock).mockReturnValue(true);
            (response.sendFile as jest.Mock).mockImplementation(() => (response.raw as EventEmitter).emit('finish'));

            await httpResponse.file('/tmp/file.txt');

            expect(response.hasHeader).toHaveBeenCalledWith('content-type');
            expect(response.sendFile).toHaveBeenCalledWith('file.txt', '/tmp', { dotfiles: 'allow', contentType: false });
        });

        it('should resolve when the connection is closed before the file is sent', async () => {
            (response.sendFile as jest.Mock).mockImplementation(() => (response.raw as EventEmitter).emit('close'));

            await expect(httpResponse.file('/tmp/file.txt')).resolves.toBeUndefined();
            expect((response.raw as EventEmitter).listenerCount('finish')).toBe(0);
            expect((response.raw as EventEmitter).listenerCount('close')).toBe(0);
        });
    });

    describe('stream', () => {
        const sendCollecting = () => {
            const chunks: Buffer[] = [];
            let body: PassThrough | undefined;
            (response.send as jest.Mock).mockImplementation((sent: PassThrough) => {
                body = sent;
                sent.on('data', (chunk: Buffer) => chunks.push(chunk));
                sent.on('end', () => (response.raw as EventEmitter).emit('finish'));
            });
            return { text: () => Buffer.concat(chunks).toString(), body: () => body };
        };

        it('should send the stream and resolve when the reply is sent', async () => {
            const { text } = sendCollecting();

            await httpResponse.stream(Readable.from(['Hello ', 'world']));

            expect(response.send).toHaveBeenCalledWith(expect.any(PassThrough));
            expect(text()).toBe('Hello world');
            expect((response.raw as EventEmitter).listenerCount('finish')).toBe(0);
            expect((response.raw as EventEmitter).listenerCount('close')).toBe(0);
        });

        it('should reject with the error of the source and destroy the body of the reply', async () => {
            const { body } = sendCollecting();
            const error = new Error('upstream failed');
            const source = new Readable({
                read() {
                    this.destroy(error);
                }
            });

            await expect(httpResponse.stream(source)).rejects.toBe(error);
            expect(body()?.destroyed).toBe(true);
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
