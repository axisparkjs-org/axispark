import { compileTrustProxy, resolveClientAddress } from './trust-proxy';

describe('trust proxy', () => {
    const headers = { 'x-forwarded-for': '203.0.113.7, 10.0.0.2' };

    it('trusts no proxy with false or undefined', () => {
        expect(compileTrustProxy(undefined)).toBeUndefined();
        expect(compileTrustProxy(false)).toBeUndefined();
        expect(resolveClientAddress('10.0.0.1', headers, compileTrustProxy(false))).toBe('10.0.0.1');
    });

    it('trusts every proxy with true', () => {
        expect(resolveClientAddress('10.0.0.1', headers, compileTrustProxy(true))).toBe('203.0.113.7');
    });

    it('trusts the number of proxies between the client and the application', () => {
        expect(resolveClientAddress('10.0.0.1', headers, compileTrustProxy(1))).toBe('10.0.0.2');
        expect(resolveClientAddress('10.0.0.1', headers, compileTrustProxy(2))).toBe('203.0.113.7');
    });

    it('trusts the proxies with the given addresses or subnets', () => {
        expect(resolveClientAddress('10.0.0.1', headers, compileTrustProxy('10.0.0.0/8'))).toBe('203.0.113.7');
        expect(resolveClientAddress('10.0.0.1', headers, compileTrustProxy('loopback, 10.0.0.1'))).toBe('10.0.0.2');
        expect(resolveClientAddress('10.0.0.1', headers, compileTrustProxy(['10.0.0.1', '10.0.0.2']))).toBe('203.0.113.7');
        expect(resolveClientAddress('192.168.1.1', headers, compileTrustProxy('10.0.0.0/8'))).toBe('192.168.1.1');
    });

    it('returns the socket address without a forwarded header or without an address', () => {
        expect(resolveClientAddress('10.0.0.1', {}, compileTrustProxy(true))).toBe('10.0.0.1');
        expect(resolveClientAddress(undefined, headers, compileTrustProxy(true))).toBeUndefined();
    });
});
