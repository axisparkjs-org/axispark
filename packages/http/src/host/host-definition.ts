import { HostPattern } from './host-pattern';

/**
 * Represents the host restriction for an HTTP request and the host received from that request.
 */
export class HostDefinition {
    public host: string | undefined;
    public acceptedHosts: string[] = [];
    /** The labels of the normalized host of the request, split once when the host is set. */
    public hostLabels: string[] | undefined;

    setHost(host: string | string[] | undefined): void {
        const value = Array.isArray(host) ? host[0] : host;
        this.host = value === undefined ? undefined : HostPattern.normalize(value);
        this.hostLabels = HostPattern.labelsOf(this.host);
    }

    setAcceptedHosts(acceptedHosts: string[]): void {
        this.acceptedHosts = acceptedHosts;
    }

    isHostAccepted(): boolean {
        return this.acceptedHosts.some((acceptedHost) => HostPattern.of(acceptedHost).matches(this.hostLabels));
    }

    static isHostAccepted(host: string | undefined, acceptedHosts: string[]): boolean {
        const hostLabels = HostPattern.labelsOf(host);
        return acceptedHosts.some((acceptedHost) => HostPattern.of(acceptedHost).matches(hostLabels));
    }

    /** Checks a host pattern against the host stored in this definition. */
    matches(hostPattern: string): boolean {
        return HostPattern.of(hostPattern).matches(this.hostLabels);
    }

    static matches(host: string | undefined, hostPattern: string): boolean {
        return HostPattern.of(hostPattern).matches(HostPattern.labelsOf(host));
    }

    /** Returns whether two host patterns can match at least one common hostname. */
    static patternsOverlap(first: string | undefined, second: string | undefined): boolean {
        if (first === undefined || second === undefined) return true;

        const normalizedFirst = HostPattern.normalize(first);
        const normalizedSecond = HostPattern.normalize(second);
        if (normalizedFirst === '*' || normalizedSecond === '*') return true;

        const firstLabels = normalizedFirst.split('.');
        const secondLabels = normalizedSecond.split('.');
        if (firstLabels.length !== secondLabels.length) return false;

        return firstLabels.every(
            (label, index) => HostPattern.isDynamicLabel(label) || HostPattern.isDynamicLabel(secondLabels[index]) || label === secondLabels[index]
        );
    }

    /** Returns whether two lists of host patterns can match at least one common hostname. */
    static hostsOverlap(first: readonly string[], second: readonly string[]): boolean {
        return first.some((firstHost) => second.some((secondHost) => HostDefinition.patternsOverlap(firstHost, secondHost)));
    }

    /** Scores a host pattern so static labels take precedence over named and wildcard labels. */
    static specificity(pattern: string): number {
        return HostPattern.of(pattern).specificity;
    }
}
