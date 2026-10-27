import { HttpContext, HttpStatusCode } from '../../types';
import { BodyHttpResult, ErrorHttpResult, FileHttpResult, RedirectHttpResult, StreamHttpResult } from './http-result';
import { BadRequestError, RateLimitExceededError } from '../errors';

const response = {
    status: jest.fn(),
    header: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
    end: jest.fn(),
    file: jest.fn(),
    stream: jest.fn()
};

const context = {
    response
} as unknown as HttpContext;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('BodyHttpResult', () => {
    it('should send a json body', async () => {
        await new BodyHttpResult({ ok: true }, HttpStatusCode.Ok).process(context);

        expect(response.status).toHaveBeenCalledWith(HttpStatusCode.Ok);
        expect(response.json).toHaveBeenCalledWith({ ok: true });

        expect(response.send).not.toHaveBeenCalled();
        expect(response.end).not.toHaveBeenCalled();
    });

    it('should send a string body', async () => {
        await new BodyHttpResult('hello', HttpStatusCode.Ok).process(context);

        expect(response.status).toHaveBeenCalledWith(HttpStatusCode.Ok);
        expect(response.send).toHaveBeenCalledWith('hello');
        expect(response.json).not.toHaveBeenCalled();
    });

    it('should end the response when value is undefined', async () => {
        await new BodyHttpResult(undefined, HttpStatusCode.NoContent).process(context);

        expect(response.status).toHaveBeenCalledWith(HttpStatusCode.NoContent);
        expect(response.end).toHaveBeenCalled();
    });

    it('should write headers', async () => {
        await new BodyHttpResult({}, HttpStatusCode.Ok).header('Content-Type', 'application/json').header('X-Test', 'true').process(context);

        expect(response.header).toHaveBeenNthCalledWith(1, 'Content-Type', 'application/json');

        expect(response.header).toHaveBeenNthCalledWith(2, 'X-Test', 'true');
    });

    it('should return itself from header()', () => {
        const result = new BodyHttpResult({}, HttpStatusCode.Ok);

        expect(result.header('A', 'B')).toBe(result);
    });
});

describe('RedirectHttpResult', () => {
    it('should create a temporary redirect', async () => {
        await new RedirectHttpResult('/login').process(context);

        expect(response.status).toHaveBeenCalledWith(HttpStatusCode.Found);
        expect(response.header).toHaveBeenCalledWith('Location', '/login');
        expect(response.end).toHaveBeenCalled();
    });

    it('should create a permanent redirect', async () => {
        await new RedirectHttpResult('/home', true).process(context);

        expect(response.status).toHaveBeenCalledWith(HttpStatusCode.MovedPermanently);
    });
});

describe('FileHttpResult', () => {
    it('should send a file', async () => {
        await new FileHttpResult('/tmp/test.txt').process(context);

        expect(response.file).toHaveBeenCalledWith('/tmp/test.txt');
    });

    it('should set headers when options are provided', async () => {
        await new FileHttpResult('/tmp/test.txt', {
            filename: 'file.txt',
            contentType: 'text/plain'
        }).process(context);

        expect(response.header).toHaveBeenCalledWith('Content-Type', 'text/plain');

        expect(response.header).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="file.txt"');
    });
});

describe('StreamHttpResult', () => {
    it('should stream the response', async () => {
        const stream = {} as NodeJS.ReadableStream;

        await new StreamHttpResult(stream).process(context);

        expect(response.stream).toHaveBeenCalledWith(stream);
    });

    it('should set headers', async () => {
        const stream = {} as NodeJS.ReadableStream;

        await new StreamHttpResult(stream, {
            filename: 'file.txt',
            contentType: 'text/plain'
        }).process(context);

        expect(response.header).toHaveBeenCalledWith('Content-Type', 'text/plain');

        expect(response.header).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="file.txt"');
    });
});

describe('ErrorHttpResult', () => {
    it('serializes rate limit errors using the established message body', async () => {
        const error = new RateLimitExceededError('Too many requests');

        await new ErrorHttpResult(error).process(context);

        expect(response.status).toHaveBeenCalledWith(HttpStatusCode.TooManyRequests);
        expect(response.json).toHaveBeenCalledWith({ message: 'Too many requests' });
    });

    it('should serialize an HttpError', async () => {
        const error = new BadRequestError('Invalid request');

        await new ErrorHttpResult(error).process(context);

        expect(response.status).toHaveBeenCalledWith(HttpStatusCode.BadRequest);

        expect(response.json).toHaveBeenCalledWith({
            error: 'Invalid request',
            status: HttpStatusCode.BadRequest
        });
    });

    it('should include cause and description when provided', async () => {
        const error = new BadRequestError('Invalid request', {
            cause: 'Missing field',
            description: 'The "name" field is required.'
        });

        await new ErrorHttpResult(error).process(context);

        expect(response.status).toHaveBeenCalledWith(HttpStatusCode.BadRequest);

        expect(response.json).toHaveBeenCalledWith({
            error: 'Invalid request',
            status: HttpStatusCode.BadRequest,
            cause: 'Missing field',
            description: 'The "name" field is required.'
        });
    });
});
