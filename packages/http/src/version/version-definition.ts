/**
 * Represents a version definition for HTTP requests, including accepted versions and the current version. Provides methods to set the current version and check if the current version is accepted.
 */
export class VersionDefinition {
    public acceptedVersions: string[] = [];
    public version: string | undefined;

    setVersion(version: string | undefined): void {
        this.version = version;
    }

    setAcceptedVersions(acceptedVersions: string[]): void {
        this.acceptedVersions = acceptedVersions;
    }

    isVersionAccepted(): boolean {
        return (
            this.acceptedVersions.some((v) => VersionDefinition.isWildcard(v)) || (this.version !== undefined && this.acceptedVersions.includes(this.version))
        );
    }

    static isVersionAccepted(version: string | undefined, acceptedVersions: string[]): boolean {
        return acceptedVersions.some((v) => VersionDefinition.isWildcard(v)) || (version !== undefined && acceptedVersions.includes(version));
    }

    static isWildcard(version: string): boolean {
        return version === '*' || version === 'default';
    }

    /** Returns whether two lists of accepted versions can match at least one common version. An empty list means versioning is disabled and overlaps with everything. */
    static versionsOverlap(first: readonly string[], second: readonly string[]): boolean {
        if (first.length === 0 || second.length === 0) return true;
        if (first.some((v) => VersionDefinition.isWildcard(v)) || second.some((v) => VersionDefinition.isWildcard(v))) return true;
        return first.some((version) => second.includes(version));
    }
}
