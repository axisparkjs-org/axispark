import {
    FilteredError as ErrorParam,
    Filter,
    Catch,
    ExecutionTransport,
    StepPriority,
    PipeStepParsingError,
    PipeStepValidationError
} from '@axisparkjs/engine';
import { BadRequestError, HttpError } from '../errors';
import { HttpStatusCode } from '../../types/http-status-code';
import { ErrorHttpResult, HttpResults } from '../results';

/**
 * A global filter for returning errors as HTTP responses.
 */
@Filter({ global: true, transport: ExecutionTransport.Http, priority: StepPriority.Base })
export class ReturnErrorFilter {
    /**
     * Handles errors by returning them as HTTP responses. Pipe-step parsing and validation errors are returned as `400 Bad Request`, and any other error that is not an `HttpError` as `500 Internal Server Error`.
     * @param error The error to handle.
     * @returns A promise resolving to an ErrorHttpResult.
     */
    @Catch(Error)
    public async error(@ErrorParam() error: Error): Promise<ErrorHttpResult> {
        if (error instanceof PipeStepParsingError || error instanceof PipeStepValidationError) {
            error = new BadRequestError(error.message, { cause: error.name });
        } else if (!(error instanceof HttpError)) {
            error = new HttpError(error.message, HttpStatusCode.InternalServerError);
        }
        return HttpResults.Error(error as HttpError);
    }
}
