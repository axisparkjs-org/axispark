import { VersionDefinition } from './version-definition';

describe('VersionDefinition', () => {
    const definitionFor = (acceptedVersions: string[] = []) => {
        const definition = new VersionDefinition();
        definition.setAcceptedVersions(acceptedVersions);
        return definition;
    };

    describe('constructor', () => {
        it('starts with no accepted versions', () => {
            const acceptedVersions = ['1', '2', '3'];

            const definition = new VersionDefinition();

            expect(definition.acceptedVersions).toEqual([]);
            definition.setAcceptedVersions(acceptedVersions);
            expect(definition.acceptedVersions).toBe(acceptedVersions);
        });

        it('should initialize version as undefined', () => {
            const definition = new VersionDefinition();

            expect(definition.version).toBeUndefined();
        });
    });

    describe('setVersion', () => {
        it('should set the requested version', () => {
            const definition = definitionFor(['1', '2']);

            definition.setVersion('2');

            expect(definition.version).toBe('2');
        });

        it('should allow setting version to undefined', () => {
            const definition = definitionFor(['1', '2']);

            definition.setVersion('2');
            definition.setVersion(undefined);

            expect(definition.version).toBeUndefined();
        });
    });

    describe('isVersionAccepted', () => {
        it('should return true when the version is accepted', () => {
            const definition = definitionFor(['1', '2']);

            definition.setVersion('2');

            expect(definition.isVersionAccepted()).toBe(true);
        });

        it('should return false when the version is not accepted', () => {
            const definition = definitionFor(['1', '2']);

            definition.setVersion('3');

            expect(definition.isVersionAccepted()).toBe(false);
        });

        it('should return false when no version has been set', () => {
            const definition = definitionFor(['1', '2']);

            expect(definition.isVersionAccepted()).toBe(false);
        });

        it('should return false when the accepted versions are empty', () => {
            const definition = definitionFor([]);

            definition.setVersion('1');

            expect(definition.isVersionAccepted()).toBe(false);
        });

        it('should compare versions exactly', () => {
            const definition = definitionFor(['1.0', '2.0']);

            definition.setVersion('1');

            expect(definition.isVersionAccepted()).toBe(false);
        });

        it('should accept any version when default is accepted', () => {
            const definition = definitionFor(['*']);

            definition.setVersion('1');

            expect(definition.isVersionAccepted()).toBe(true);
        });

        it('should accept any version when default is among the accepted versions', () => {
            const definition = definitionFor(['1', '*']);

            definition.setVersion('3');

            expect(definition.isVersionAccepted()).toBe(true);
        });

        it('should accept an undefined version when default is accepted', () => {
            const definition = definitionFor(['*']);

            expect(definition.isVersionAccepted()).toBe(true);
        });

        it('keeps the documented default marker as a wildcard alias', () => {
            const definition = definitionFor(['default']);
            definition.setVersion('3');

            expect(definition.isVersionAccepted()).toBe(true);
            expect(VersionDefinition.isVersionAccepted(undefined, ['default'])).toBe(true);
        });

        it('should still accept an explicitly accepted version when default is present', () => {
            const definition = definitionFor(['1', '*']);

            definition.setVersion('1');

            expect(definition.isVersionAccepted()).toBe(true);
        });

        it('should not accept an unaccepted version without default', () => {
            const definition = definitionFor(['1', '2']);

            definition.setVersion('3');

            expect(definition.isVersionAccepted()).toBe(false);
        });
    });

    describe('versionsOverlap', () => {
        it('overlaps when either side has no versions', () => {
            expect(VersionDefinition.versionsOverlap([], ['1'])).toBe(true);
            expect(VersionDefinition.versionsOverlap(['1'], [])).toBe(true);
        });

        it('overlaps when either side is a wildcard or default', () => {
            expect(VersionDefinition.versionsOverlap(['*'], ['1'])).toBe(true);
            expect(VersionDefinition.versionsOverlap(['1'], ['default'])).toBe(true);
        });

        it('overlaps only when a version is shared', () => {
            expect(VersionDefinition.versionsOverlap(['1', '2'], ['2', '3'])).toBe(true);
            expect(VersionDefinition.versionsOverlap(['1'], ['2'])).toBe(false);
        });
    });
});
