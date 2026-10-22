import { HttpStatusCode } from '../../types/http-status-code';

/**
 * A base class for HTTP errors.
 */
export class HttpError extends Error {
    public constructor(
        public readonly response: string,
        public readonly status: number,
        public readonly options?: { cause?: unknown; description?: string }
    ) {
        super(response);
        this.name = this.constructor.name;
    }
}

/**
 * An error for a request the server cannot or will not process due to a perceived client error.
 * @see https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.1
 */
export class BadRequestError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.BadRequest, options);
    }
}
/**
 * An error thrown when the client is not authorized to access the requested resource.
 */
export class UnauthorizedError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.Unauthorized, options);
    }
}
/**
 * An error thrown when the client is forbidden from accessing the requested resource.
 */
export class PaymentRequiredError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.PaymentRequired, options);
    }
}
/**
 * An error thrown when the requested resource is not found.
 */
export class ForbiddenError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.Forbidden, options);
    }
}
/**
 * An error thrown when the requested resource is not found.
 */
export class NotFoundError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.NotFound, options);
    }
}
/**
 * An error thrown when the requested method is not allowed for the requested resource.
 */
export class MethodNotAllowedError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.MethodNotAllowed, options);
    }
}
/**
 * An error thrown when the requested resource is not acceptable according to the Accept headers sent in the request.
 */
export class NotAcceptableError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.NotAcceptable, options);
    }
}
/**
 * An error thrown when the client must authenticate itself to get the requested response.
 */
export class ProxyAuthenticationRequiredError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.ProxyAuthenticationRequired, options);
    }
}
/**
 * An error thrown when the server timed out waiting for the request.
 */
export class RequestTimeoutError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.RequestTimeout, options);
    }
}
/**
 * An error thrown when the request conflicts with the current state of the server.
 */
export class ConflictError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.Conflict, options);
    }
}
/**
 * An error thrown when the requested resource is no longer available.
 */
export class GoneError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.Gone, options);
    }
}
/**
 * An error thrown when the server requires the client to specify the length of the request body.
 */
export class LengthRequiredError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.LengthRequired, options);
    }
}
/**
 * An error thrown when the server returns a 412 Precondition Failed response.
 */
export class PreconditionFailedError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.PreconditionFailed, options);
    }
}
/**
 * An error thrown when the server returns a 413 Content Too Large response.
 * @see https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.14
 */
export class ContentTooLargeError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.ContentTooLarge, options);
    }
}

/**
 * @deprecated Use ContentTooLargeError, the RFC 9110 name for status 413.
 */
export class PayloadTooLargeError extends ContentTooLargeError {}
/**
 * An error thrown when the server returns a 414 URI Too Long response.
 */
export class UriTooLongError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.UriTooLong, options);
    }
}
/**
 * An error thrown when the server returns a 415 Unsupported Media Type response.
 */
export class UnsupportedMediaTypeError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.UnsupportedMediaType, options);
    }
}
/**
 * An error thrown when the server returns a 416 Range Not Satisfiable response.
 * @see https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.17
 */
export class RangeNotSatisfiableError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.RangeNotSatisfiable, options);
    }
}

/**
 * @deprecated Use RangeNotSatisfiableError, the RFC 9110 name for status 416.
 */
export class RequestedRangeNotSatisfiableError extends RangeNotSatisfiableError {}
/**
 * An error thrown when the server returns a 417 Expectation Failed response.
 */
export class ExpectationFailedError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.ExpectationFailed, options);
    }
}
/**
 * An error for status 418, which RFC 9110 marks as reserved and unused.
 * Avoid using this status for application responses.
 * @see https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.19
 */
export class UnusedError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.Unused, options);
    }
}

/**
 * @deprecated Status 418 is reserved and unused according to RFC 9110.
 */
export class IAmATeapotError extends UnusedError {}
/**
 * An error thrown when the server returns a 421 Misdirected Request response.
 * @see https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.20
 */
export class MisdirectedRequestError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.MisdirectedRequest, options);
    }
}

/**
 * @deprecated Use MisdirectedRequestError, the RFC 9110 name for status 421.
 */
export class MisdirectedError extends MisdirectedRequestError {}
/**
 * An error thrown when the server returns a 422 Unprocessable Content response.
 * @see https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.21
 */
export class UnprocessableContentError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.UnprocessableContent, options);
    }
}

/**
 * @deprecated Use UnprocessableContentError, the RFC 9110 name for status 422.
 */
export class UnprocessableEntityError extends UnprocessableContentError {}
/**
 * An error thrown when the server returns a 423 Locked response.
 */
export class LockedError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.Locked, options);
    }
}
/**
 * An error thrown when the server returns a 424 Failed Dependency response.
 */
export class FailedDependencyError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.FailedDependency, options);
    }
}
/**
 * An error thrown when the server returns a 428 Precondition Required response.
 */
export class PreconditionRequiredError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.PreconditionRequired, options);
    }
}
/**
 * An error thrown when the server returns a 429 Too Many Requests response.
 */
export class TooManyRequestsError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.TooManyRequests, options);
    }
}

/** An HTTP 429 error raised when a configured rate limit is exceeded. */
export class RateLimitExceededError extends TooManyRequestsError {}
/**
 * An error thrown when the server returns a 456 Unrecoverable Error response.
 */
export class UnrecoverableError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.UnrecoverableError, options);
    }
}
/**
 * An error thrown when the server returns a 500 Internal Server Error response.
 */
export class InternalServerError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.InternalServerError, options);
    }
}
/**
 * An error thrown when the server returns a 501 Not Implemented response.
 */
export class NotImplementedError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.NotImplemented, options);
    }
}
/**
 * An error thrown when the server returns a 502 Bad Gateway response.
 */
export class BadGatewayError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.BadGateway, options);
    }
}
/**
 * An error thrown when the server returns a 503 Service Unavailable response.
 */
export class ServiceUnavailableError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.ServiceUnavailable, options);
    }
}
/**
 * An error thrown when the server returns a 504 Gateway Timeout response.
 */
export class GatewayTimeoutError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.GatewayTimeout, options);
    }
}
/**
 * An error thrown when the server returns a 505 HTTP Version Not Supported response.
 */
export class HttpVersionNotSupportedError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.HttpVersionNotSupported, options);
    }
}
/**
 * An error thrown when the server returns a 507 Insufficient Storage response.
 */
export class InsufficientStorageError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.InsufficientStorage, options);
    }
}
/**
 * An error thrown when the server returns a 508 Loop Detected response.
 */
export class LoopDetectedError extends HttpError {
    constructor(response: string, options?: { cause?: unknown; description?: string }) {
        super(response, HttpStatusCode.LoopDetected, options);
    }
}
