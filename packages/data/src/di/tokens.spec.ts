import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { InjectDataSource, InjectRepository, DATA_LOGGER, DATA_OPTIONS, dataRepositoryToken, dataSourceToken } from './tokens';

describe('data dependency injection tokens', () => {
    class UserRepository {}
    class Consumer {}

    it('exports stable options and logger tokens', () => {
        expect(DATA_OPTIONS.description).toBe('DATA_OPTIONS');
        expect(DATA_LOGGER.description).toBe('DATA_LOGGER');
    });

    it('creates a repository injection decorator using the repository class name', () => {
        InjectRepository(UserRepository)(Consumer, undefined, 0);

        const metadata = Metadata.get<{ params: Map<number, { description: string }> }>(MetadataKeys.INJECT, Consumer);
        expect(metadata?.params.get(0)?.description).toBe('DATA_REPOSITORY_USERREPOSITORY');
        expect(metadata?.params.get(0)).toBe(dataRepositoryToken(UserRepository));
    });

    it('creates different repository tokens for two classes with the same name', () => {
        const OtherUserRepository = (() => class UserRepository {})();

        expect(dataRepositoryToken(UserRepository)).toBe(dataRepositoryToken(UserRepository));
        expect(dataRepositoryToken(OtherUserRepository)).not.toBe(dataRepositoryToken(UserRepository));
    });

    it('returns the same data source token for the same name, ignoring the case', () => {
        expect(dataSourceToken('primary')).toBe(dataSourceToken('PRIMARY'));
        expect(dataSourceToken('primary')).not.toBe(dataSourceToken('secondary'));
    });

    it('creates a data source injection decorator using the uppercase source name', () => {
        InjectDataSource('primary')(Consumer, undefined, 1);

        const metadata = Metadata.get<{ params: Map<number, { description: string }> }>(MetadataKeys.INJECT, Consumer);
        expect(metadata?.params.get(1)?.description).toBe('DATA_SOURCE_PRIMARY');
        expect(metadata?.params.get(1)).toBe(dataSourceToken('PRIMARY'));
    });
});
