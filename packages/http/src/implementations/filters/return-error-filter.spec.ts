import { ReturnErrorFilter } from './return-error-filter';
import { HttpError } from '../errors';
import { HttpResults } from '../results/http-results';
import { HttpStatusCode } from '../../types/http-status-code';
import { ParameterDefinition, PipeStepError, PipeStepParsingError, PipeStepValidationError } from '@axisparkjs/engine';

jest.mock('../results/http-results', () => ({
    HttpResults: {
        Error: jest.fn()
    }
}));

describe('ReturnErrorFilter', () => {
    let filter: ReturnErrorFilter;

    beforeEach(() => {
        jest.clearAllMocks();
        filter = new ReturnErrorFilter();
    });

    it('should return the same HttpError', async () => {
        const error = new HttpError('Not Found', HttpStatusCode.NotFound);

        const expected = {} as any;
        (HttpResults.Error as jest.Mock).mockReturnValue(expected);

        const result = await filter.error(error);

        expect(HttpResults.Error).toHaveBeenCalledWith(error);
        expect(result).toBe(expected);
    });

    it('should wrap a generic Error into HttpError', async () => {
        const error = new Error('Boom');

        const expected = {} as any;
        (HttpResults.Error as jest.Mock).mockReturnValue(expected);

        const result = await filter.error(error);

        expect(HttpResults.Error).toHaveBeenCalledTimes(1);

        const httpError = (HttpResults.Error as jest.Mock).mock.calls[0][0];

        expect(httpError).toBeInstanceOf(HttpError);
        expect(httpError.message).toBe('Boom');
        expect(httpError.status).toBe(HttpStatusCode.InternalServerError);

        expect(result).toBe(expected);
    });

    describe('pipe-step errors', () => {
        const parameter = { parameter: 'id' } as ParameterDefinition;

        it.each([
            ['PipeStepParsingError', new PipeStepParsingError(parameter, "Value 'abc' is not a valid integer.", 'integer')],
            ['PipeStepValidationError', new PipeStepValidationError(parameter, 'Value must be between 1 and 10.')]
        ])('should return a %s as a Bad Request HttpError', async (name, error) => {
            await filter.error(error);

            const httpError = (HttpResults.Error as jest.Mock).mock.calls[0][0];

            expect(httpError).toBeInstanceOf(HttpError);
            expect(httpError.status).toBe(HttpStatusCode.BadRequest);
            expect(httpError.message).toBe(error.message);
            expect(httpError.options).toEqual({ cause: name });
        });

        it('should return any other PipeStepError as an Internal Server Error', async () => {
            const error = new PipeStepError(parameter, 'Misconfigured pipe-step.');

            await filter.error(error);

            const httpError = (HttpResults.Error as jest.Mock).mock.calls[0][0];

            expect(httpError.status).toBe(HttpStatusCode.InternalServerError);
            expect(httpError.message).toBe('Misconfigured pipe-step.');
        });
    });
});
