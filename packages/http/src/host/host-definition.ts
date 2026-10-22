/**
 * Represents the host restriction for an HTTP request and the host received from that request.
 */
export class HostDefinition {
    public host: string | undefined;
    public acceptedHosts: string[] = [];

    setHost(host: string | string[] | undefined): void {
        const value = Array.isArray(host) ? host[0] : host;
        this.host = value === undefined ? undefined : HostDefinition.normalizeHost(value);
    }

    setAcceptedHosts(acceptedHosts: string[]): void {
        this.acceptedHosts = acceptedHosts;
    }

    isHostAccepted(): boolean {
        return this.acceptedHosts.some((acceptedHost) => this.matches(acceptedHost));
    }

    static isHostAccepted(host: string | undefined, acceptedHosts: string[]): boolean {
        return acceptedHosts.some((acceptedHost) => HostDefinition.matches(host, acceptedHost));
    }

    /** Checks a host pattern against the host stored in this definition. */
    matches(hostPattern: string): boolean {
        return HostDefinition.matches(this.host, hostPattern);
    }

    static matches(host: string | undefined, hostPattern: string): boolean {
        const normalizedPattern = HostDefinition.normalizeHost(hostPattern);
        if (normalizedPattern === '*') return true;
        if (!host) return false;

        const patternLabels = normalizedPattern.split('.');
        const hostLabels = HostDefinition.normalizeHost(host).split('.');
        if (patternLabels.length !== hostLabels.length) return false;

        return patternLabels.every((label, index) => HostDefinition.isDynamicLabel(label) || label === hostLabels[index]);
    }

    /** Returns whether two host patterns can match at least one common hostname. */
    static patternsOverlap(first: string | undefined, second: string | undefined): boolean {
        if (first === undefined || second === undefined) return true;

        const normalizedFirst = HostDefinition.normalizeHost(first);
        const normalizedSecond = HostDefinition.normalizeHost(second);
        if (normalizedFirst === '*' || normalizedSecond === '*') return true;

        const firstLabels = normalizedFirst.split('.');
        const secondLabels = normalizedSecond.split('.');
        if (firstLabels.length !== secondLabels.length) return false;

        return firstLabels.every(
            (label, index) => HostDefinition.isDynamicLabel(label) || HostDefinition.isDynamicLabel(secondLabels[index]) || label === secondLabels[index]
        );
    }

    /** Returns whether two lists of host patterns can match at least one common hostname. */
    static hostsOverlap(first: readonly string[], second: readonly string[]): boolean {
        return first.some((firstHost) => second.some((secondHost) => HostDefinition.patternsOverlap(firstHost, secondHost)));
    }

    /** Scores a host pattern so static labels take precedence over named and wildcard labels. */
    static specificity(pattern: string): number {
        return HostDefinition.normalizeHost(pattern)
            .split('.')
            .reduce((score, label) => score + (label === '*' ? 1 : label.startsWith(':') ? 10 : 100), 0);
    }

    private static normalizeHost(host: string): string {
        return HostDefinition.removePort(host.trim()).toLowerCase().replace(/\.$/, '');
    }

    private static removePort(host: string): string {
        if (host.startsWith('[')) {
            const bracketedHost = host.match(/^(\[[^\]]+\])(?::\d+)?$/);
            return bracketedHost?.[1] ?? host;
        }
        return host.replace(/:\d+$/, '');
    }

    private static isDynamicLabel(label: string): boolean {
        return label === '*' || label.startsWith(':');
    }
}
