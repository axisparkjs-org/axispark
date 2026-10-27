import { defaultStatusCode } from './http-status-code';
import { HttpStatusCode } from './http-status-code';

describe('defaultStatusCode', () => {
    it('should return Ok for GET', () => {
        expect(defaultStatusCode('GET')).toBe(HttpStatusCode.Ok);
    });

    it('should be case insensitive', () => {
        expect(defaultStatusCode('get')).toBe(HttpStatusCode.Ok);
        expect(defaultStatusCode('GeT')).toBe(HttpStatusCode.Ok);
    });

    it('should return Created for POST', () => {
        expect(defaultStatusCode('POST')).toBe(HttpStatusCode.Created);
    });

    it('should return Ok for PUT', () => {
        expect(defaultStatusCode('PUT')).toBe(HttpStatusCode.Ok);
    });

    it('should return Ok for PATCH', () => {
        expect(defaultStatusCode('PATCH')).toBe(HttpStatusCode.Ok);
    });

    it('should return NoContent for DELETE', () => {
        expect(defaultStatusCode('DELETE')).toBe(HttpStatusCode.NoContent);
    });

    it('should return Ok for unknown methods', () => {
        expect(defaultStatusCode('OPTIONS')).toBe(HttpStatusCode.Ok);
        expect(defaultStatusCode('HEAD')).toBe(HttpStatusCode.Ok);
    });
});

describe('RFC 9110 status names', () => {
    it.each([
        [300, 'MultipleChoices', HttpStatusCode.MultipleChoices, HttpStatusCode.Ambiguous],
        [413, 'ContentTooLarge', HttpStatusCode.ContentTooLarge, HttpStatusCode.PayloadTooLarge],
        [416, 'RangeNotSatisfiable', HttpStatusCode.RangeNotSatisfiable, HttpStatusCode.RequestedRangeNotSatisfiable],
        [418, 'Unused', HttpStatusCode.Unused, HttpStatusCode.IAmATeapot],
        [421, 'MisdirectedRequest', HttpStatusCode.MisdirectedRequest, HttpStatusCode.Misdirected],
        [422, 'UnprocessableContent', HttpStatusCode.UnprocessableContent, HttpStatusCode.UnprocessableEntity]
    ])('uses %s as the canonical name', (status, canonicalName, canonicalValue, legacyValue) => {
        expect(canonicalValue).toBe(status);
        expect(legacyValue).toBe(status);
        expect(HttpStatusCode[status as number]).toBe(canonicalName);
    });
});
