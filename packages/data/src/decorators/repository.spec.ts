import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ClassRegistry } from '@axisparkjs/di';
import { Repository } from './repository';

describe('@Repository', () => {
    class UserEntity {}
    class UserRepository {}

    afterAll(() => {
        ClassRegistry.remove(UserRepository);
    });

    it('stores the entity metadata and marks the repository injectable', () => {
        Repository({ entity: UserEntity as any })(UserRepository);

        expect(Metadata.get(MetadataKeys.REPOSITORY, UserRepository)).toEqual({ target: UserRepository, entity: UserEntity });
        expect(Metadata.has(MetadataKeys.INJECTABLE, UserRepository)).toBe(true);
        expect(ClassRegistry.has(UserRepository)).toBe(true);
    });
});
