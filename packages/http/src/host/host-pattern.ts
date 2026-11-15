/**
 * A host pattern of a route, normalized and split in labels once, with its specificity. The patterns are compiled when the routes are
 * registered (`RouteDefinition.hostPatterns`) and cached by their text, so matching a request does not normalize or split any pattern.
 */
export class HostPattern {
    private static readonly compiled = new Map<string, HostPattern>();

    /** Whether the pattern is `*`, which matches every host, also a request without host. */
    public readonly any: boolean;
    /** The labels of the normalized pattern. */
    public readonly labels: readonly string[];
    /** The score of the pattern: static labels take precedence over named (`:name`) and wildcard (`*`) labels. */
    public readonly specificity: number;

    private constructor(public readonly pattern: string) {
        const normalized = HostPattern.normalize(pattern);
        this.any = normalized === '*';
        this.labels = normalized.split('.');
        this.specificity = this.labels.reduce((score, label) => score + (label === '*' ? 1 : label.startsWith(':') ? 10 : 100), 0);
    }

    /**
     * Returns the compiled pattern of a host pattern. The compiled patterns are cached by their text.
     * @param pattern The host pattern, such as `api.example.com`, `:tenant.example.com` or `*`.
     */
    static of(pattern: string): HostPattern {
        let compiled = this.compiled.get(pattern);
        if (!compiled) {
            compiled = new HostPattern(pattern);
            this.compiled.set(pattern, compiled);
        }
        return compiled;
    }

    /**
     * Checks the pattern against the labels of a normalized host.
     * @param hostLabels The labels of the host, as returned by `HostPattern.labelsOf()`, or `undefined` when the request has no host.
     */
    matches(hostLabels: readonly string[] | undefined): boolean {
        if (this.any) return true;
        if (!hostLabels || this.labels.length !== hostLabels.length) return false;

        return this.labels.every((label, index) => HostPattern.isDynamicLabel(label) || label === hostLabels[index]);
    }

    /**
     * Normalizes a host and splits it in labels.
     * @param host The host, with or without port.
     * @returns The labels, or `undefined` when there is no host.
     */
    static labelsOf(host: string | undefined): string[] | undefined {
        return host ? HostPattern.normalize(host).split('.') : undefined;
    }

    /** Normalizes a host or a host pattern: trimmed, without port, lowercase and without the final dot. */
    static normalize(host: string): string {
        return HostPattern.removePort(host.trim()).toLowerCase().replace(/\.$/, '');
    }

    /** Returns whether a label matches any label (`*` or `:name`). */
    static isDynamicLabel(label: string): boolean {
        return label === '*' || label.startsWith(':');
    }

    private static removePort(host: string): string {
        if (host.startsWith('[')) {
            const bracketedHost = host.match(/^(\[[^\]]+\])(?::\d+)?$/);
            return bracketedHost?.[1] ?? host;
        }
        return host.replace(/:\d+$/, '');
    }
}
