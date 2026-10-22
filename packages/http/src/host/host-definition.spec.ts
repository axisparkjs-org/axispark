import { HostDefinition } from './host-definition';

describe('HostDefinition', () => {
    const definitionFor = (acceptedHosts: string[] = []) => {
        const definition = new HostDefinition();
        definition.setAcceptedHosts(acceptedHosts);
        return definition;
    };

    it('accepts a case-insensitive hostname and ignores the port', () => {
        const definition = definitionFor(['Admin.Example.com']);
        definition.setHost('ADMIN.EXAMPLE.COM:3000');

        expect(definition.isHostAccepted()).toBe(true);
    });

    it('supports wildcard and named labels', () => {
        const wildcard = definitionFor(['*.example.com']);
        wildcard.setHost('acme.example.com');
        const named = definitionFor([':tenant.example.com']);
        named.setHost('globex.example.com');

        expect(wildcard.isHostAccepted()).toBe(true);
        expect(named.isHostAccepted()).toBe(true);
    });

    it('uses the first host when the request header contains multiple values', () => {
        const definition = definitionFor(['admin.example.com']);
        definition.setHost(['admin.example.com', 'api.example.com']);

        expect(definition.host).toBe('admin.example.com');
        expect(definition.isHostAccepted()).toBe(true);
    });

    it('normalizes trailing dots and bracketed IPv6 hosts', () => {
        const dnsHost = definitionFor(['admin.example.com.']);
        dnsHost.setHost('ADMIN.EXAMPLE.COM.:3000');
        const ipv6Host = definitionFor(['[::1]']);
        ipv6Host.setHost('[::1]:3000');

        expect(dnsHost.isHostAccepted()).toBe(true);
        expect(ipv6Host.isHostAccepted()).toBe(true);
    });

    it('rejects when no host is set or the label count differs', () => {
        const definition = definitionFor(['*.example.com']);

        expect(definition.isHostAccepted()).toBe(false);
        definition.setHost('example.com');
        expect(definition.isHostAccepted()).toBe(false);
    });

    it('treats a global wildcard as matching any host, including an absent host', () => {
        const definition = definitionFor(['*']);

        expect(definition.isHostAccepted()).toBe(true);
        definition.setHost('admin.example.com:3000');
        expect(definition.isHostAccepted()).toBe(true);
        expect(HostDefinition.matches(undefined, '*')).toBe(true);
    });

    it('detects overlapping host patterns', () => {
        expect(HostDefinition.patternsOverlap('*.example.com', ':tenant.example.com')).toBe(true);
        expect(HostDefinition.patternsOverlap('admin.example.com', 'api.example.com')).toBe(false);
        expect(HostDefinition.patternsOverlap('admin.example.com', 'admin.example.com:3000')).toBe(true);
        expect(HostDefinition.patternsOverlap('admin.example.com', undefined)).toBe(true);
    });

    it('does not overlap when the label count differs or only one side is unrestricted', () => {
        expect(HostDefinition.patternsOverlap('example.com', 'api.example.com')).toBe(false);
        expect(HostDefinition.patternsOverlap(undefined, 'admin.example.com')).toBe(true);
    });

    it('treats a global wildcard as overlapping any pattern', () => {
        expect(HostDefinition.patternsOverlap('*', 'admin.example.com')).toBe(true);
        expect(HostDefinition.patternsOverlap('admin.example.com', '*')).toBe(true);
    });

    it('detects overlapping host pattern lists', () => {
        expect(HostDefinition.hostsOverlap(['a.example.com', 'b.example.com'], ['b.example.com'])).toBe(true);
        expect(HostDefinition.hostsOverlap(['a.example.com'], ['b.example.com'])).toBe(false);
        expect(HostDefinition.hostsOverlap(['*'], ['b.example.com'])).toBe(true);
    });

    it('scores static labels above named and wildcard labels', () => {
        expect(HostDefinition.specificity('admin.example.com')).toBeGreaterThan(HostDefinition.specificity(':tenant.example.com'));
        expect(HostDefinition.specificity(':tenant.example.com')).toBeGreaterThan(HostDefinition.specificity('*.example.com'));
    });

    it('does not match a host that has a different static label', () => {
        expect(HostDefinition.patternsOverlap('admin.example.com', ':tenant.other.com')).toBe(false);
    });
});
