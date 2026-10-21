/**
 * Enumeration of HTTP status codes used in responses.
 */
export enum HttpStatusCode {
    Continue = 100,
    SwitchingProtocols = 101,
    Processing = 102,
    EarlyHints = 103,
    Ok = 200,
    Created = 201,
    Accepted = 202,
    NonAuthoritativeInformation = 203,
    NoContent = 204,
    ResetContent = 205,
    PartialContent = 206,
    MultiStatus = 207,
    AlreadyReported = 208,
    ContentDifferent = 210,
    /** @deprecated Use MultipleChoices, the RFC 9110 name for status 300. */
    Ambiguous = 300,
    /** 300 Multiple Choices. @see https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.1 */
    MultipleChoices = 300, // eslint-disable-line @typescript-eslint/no-duplicate-enum-values -- retain the deprecated alias
    MovedPermanently = 301,
    Found = 302,
    SeeOther = 303,
    NotModified = 304,
    TemporaryRedirect = 307,
    PermanentRedirect = 308,
    BadRequest = 400,
    Unauthorized = 401,
    PaymentRequired = 402,
    Forbidden = 403,
    NotFound = 404,
    MethodNotAllowed = 405,
    NotAcceptable = 406,
    ProxyAuthenticationRequired = 407,
    RequestTimeout = 408,
    Conflict = 409,
    Gone = 410,
    LengthRequired = 411,
    PreconditionFailed = 412,
    /** @deprecated RFC 9110 calls status 413 Content Too Large. Use ContentTooLarge. */
    PayloadTooLarge = 413,
    /** 413 Content Too Large. @see https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.14 */
    ContentTooLarge = 413, // eslint-disable-line @typescript-eslint/no-duplicate-enum-values -- retain the deprecated alias
    UriTooLong = 414,
    UnsupportedMediaType = 415,
    /** @deprecated RFC 9110 calls status 416 Range Not Satisfiable. Use RangeNotSatisfiable. */
    RequestedRangeNotSatisfiable = 416,
    /** 416 Range Not Satisfiable. @see https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.17 */
    RangeNotSatisfiable = 416, // eslint-disable-line @typescript-eslint/no-duplicate-enum-values -- retain the deprecated alias
    ExpectationFailed = 417,
    /** @deprecated RFC 9110 reserves status 418 as unused. */
    IAmATeapot = 418,
    /** 418 (Unused), reserved by RFC 9110. @see https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.19 */
    Unused = 418, // eslint-disable-line @typescript-eslint/no-duplicate-enum-values -- retain the deprecated alias
    /** @deprecated Use MisdirectedRequest. */
    Misdirected = 421,
    /** 421 Misdirected Request. @see https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.20 */
    MisdirectedRequest = 421, // eslint-disable-line @typescript-eslint/no-duplicate-enum-values -- retain the deprecated alias
    /** @deprecated RFC 9110 calls status 422 Unprocessable Content. Use UnprocessableContent. */
    UnprocessableEntity = 422,
    /** 422 Unprocessable Content. @see https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.21 */
    UnprocessableContent = 422, // eslint-disable-line @typescript-eslint/no-duplicate-enum-values -- retain the deprecated alias
    Locked = 423,
    FailedDependency = 424,
    PreconditionRequired = 428,
    TooManyRequests = 429,
    UnrecoverableError = 456,
    InternalServerError = 500,
    NotImplemented = 501,
    BadGateway = 502,
    ServiceUnavailable = 503,
    GatewayTimeout = 504,
    HttpVersionNotSupported = 505,
    InsufficientStorage = 507,
    LoopDetected = 508
}

export const defaultStatusCode = (method: string): HttpStatusCode => {
    switch (method.toUpperCase()) {
        case 'GET':
            return HttpStatusCode.Ok;
        case 'POST':
            return HttpStatusCode.Created;
        case 'PUT':
            return HttpStatusCode.Ok;
        case 'DELETE':
            return HttpStatusCode.NoContent;
        case 'PATCH':
            return HttpStatusCode.Ok;
        default:
            return HttpStatusCode.Ok;
    }
};
