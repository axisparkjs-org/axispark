import { HostPattern } from './host-pattern';

describe('HostPattern', () => {
    it('should compile each pattern once', () => {
        expect(HostPattern.of('API.Example.com.')).toBe(HostPattern.of('API.Example.com.'));
        expect(HostPattern.of('api.example.com').labels).toEqual(['api', 'example', 'com']);
        expect(HostPattern.of('API.Example.com.').labels).toEqual(['api', 'example', 'com']);
    });

    it('should score static, named and wildcard labels', () => {
        expect(HostPattern.of('api.example.com').specificity).toBe(300);
        expect(HostPattern.of(':tenant.example.com').specificity).toBe(210);
        expect(HostPattern.of('*.example.com').specificity).toBe(201);
    });

    it('should match the labels of a host', () => {
        expect(HostPattern.of('api.example.com').matches(HostPattern.labelsOf('API.example.com:8080'))).toBe(true);
        expect(HostPattern.of(':tenant.example.com').matches(HostPattern.labelsOf('acme.example.com'))).toBe(true);
        expect(HostPattern.of('*.example.com').matches(HostPattern.labelsOf('example.com'))).toBe(false);
        expect(HostPattern.of('api.example.com').matches(HostPattern.labelsOf('web.example.com'))).toBe(false);
        expect(HostPattern.of('api.example.com').matches(undefined)).toBe(false);
    });

    it('should match every host, also a missing host, with *', () => {
        expect(HostPattern.of('*').any).toBe(true);
        expect(HostPattern.of('*').matches(undefined)).toBe(true);
        expect(HostPattern.of(' * ').matches(['a', 'b'])).toBe(true);
    });

    it('should remove the port of IPv6 hosts', () => {
        expect(HostPattern.labelsOf('[::1]:3000')).toEqual(['[::1]']);
        expect(HostPattern.labelsOf('[::1')).toEqual(['[::1']);
        expect(HostPattern.labelsOf(undefined)).toBeUndefined();
        expect(HostPattern.labelsOf('')).toBeUndefined();
    });
});
