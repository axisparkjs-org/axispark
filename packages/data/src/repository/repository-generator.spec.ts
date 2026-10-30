import { DataSource, ObjectLiteral, Repository } from 'typeorm';
import { Metadata } from '@axisparkjs/common';
import { ClassRegistry } from '@axisparkjs/di';
import { BaseRepository } from './base-repository';
import { RepositoryMetadata } from '../metadata/repository-metadata';
import { RepositoryGenerator } from './repository-generator';
import { RepositoryDefinition } from './repository-definition';

interface TestEntity extends ObjectLiteral {
    id: number;
}

class TestRepository extends BaseRepository<TestEntity> {}

class RepositoryWithUndefinedMember extends TestRepository {
    get unsetMember(): undefined {
        return undefined;
    }
}

class TestEntityTarget {}

describe('RepositoryGenerator implementation proxy', () => {
    it('does not expose a synthetic then method and remains promise-resolvable', async () => {
        const queryEngine = { execute: jest.fn() };
        const connectionManager = { getAllConnections: jest.fn(() => new Map()) };
        const generator = new RepositoryGenerator(connectionManager as any, queryEngine as any);
        const entityRepository = { createQueryBuilder: jest.fn() } as unknown as Repository<TestEntity>;
        const dataSource = {} as DataSource;
        const implementation = (generator as any).generateImplementation(TestRepository, [entityRepository, dataSource]);

        expect(implementation.then).toBeUndefined();
        await expect(Promise.resolve(implementation)).resolves.toBe(implementation);
    });

    it('routes derived method calls to QueryEngine', async () => {
        const result = [{ id: 1 }];
        const queryEngine = { execute: jest.fn().mockResolvedValue(result) };
        const connectionManager = { getAllConnections: jest.fn(() => new Map()) };
        const generator = new RepositoryGenerator(connectionManager as any, queryEngine as any);
        const entityRepository = { createQueryBuilder: jest.fn() } as unknown as Repository<TestEntity>;
        const dataSource = {} as DataSource;
        const implementation = (generator as any).generateImplementation(TestRepository, [entityRepository, dataSource]);

        await expect(implementation.findById(1)).resolves.toBe(result);
        expect(queryEngine.execute).toHaveBeenCalledWith(expect.any(TestRepository), 'findById', [entityRepository, dataSource], [1]);
    });

    it('preserves existing members and does not synthesize non-query properties', () => {
        const queryEngine = { execute: jest.fn() };
        const connectionManager = { getAllConnections: jest.fn(() => new Map()) };
        const generator = new RepositoryGenerator(connectionManager as any, queryEngine as any);
        const entityRepository = { createQueryBuilder: jest.fn() } as unknown as Repository<TestEntity>;
        const dataSource = {} as DataSource;
        const implementation = (generator as any).generateImplementation(RepositoryWithUndefinedMember, [entityRepository, dataSource]);

        expect(implementation.save).toEqual(expect.any(Function));
        expect(implementation.entityRepository).toBe(entityRepository);
        expect(implementation.unsetMember).toBeUndefined();
        expect(implementation.unrecognized).toBeUndefined();
        expect(implementation[Symbol.toStringTag]).toBeUndefined();
    });
});

describe('RepositoryGenerator.generate', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const createGenerator = (connections: Map<string, DataSource>, entity: new () => TestEntity) => {
        const connectionManager = { getAllConnections: jest.fn(() => connections) };
        const queryEngine = { execute: jest.fn() };
        jest.spyOn(ClassRegistry, 'getWithMetadata').mockReturnValue([TestRepository as any]);
        jest.spyOn(Metadata, 'get').mockReturnValue({ target: TestRepository, entity } as unknown as RepositoryMetadata);
        return new RepositoryGenerator(connectionManager as any, queryEngine as any);
    };

    it('generates repositories using the data source that contains the entity', async () => {
        const entityRepository = { createQueryBuilder: jest.fn() } as unknown as Repository<TestEntity>;
        const sourceWithoutEntity = {
            options: { type: 'sqlite' },
            entityMetadatas: [{ name: 'OtherEntity' }],
            getRepository: jest.fn()
        } as any;
        const sourceWithEntity = {
            options: { type: 'sqlite' },
            entityMetadatas: [{ name: TestEntityTarget.name }],
            getRepository: jest.fn().mockReturnValue(entityRepository),
            getMongoRepository: jest.fn()
        } as any;
        const entityTarget = TestEntityTarget as unknown as new () => TestEntity;
        const generator = createGenerator(
            new Map([
                ['OTHER', sourceWithoutEntity],
                ['PRIMARY', sourceWithEntity]
            ]),
            entityTarget
        );

        const definitions = await generator.generate();

        expect(definitions).toHaveLength(1);
        expect(definitions[0]).toBeInstanceOf(RepositoryDefinition);
        expect(definitions[0]).toMatchObject({
            target: TestRepository,
            entity: entityTarget,
            dataSourceName: 'PRIMARY'
        });
        expect(sourceWithoutEntity.getRepository).not.toHaveBeenCalled();
        expect(sourceWithEntity.getRepository).toHaveBeenCalledWith(entityTarget);
        expect(sourceWithEntity.getMongoRepository).not.toHaveBeenCalled();
        expect(definitions[0].implementation).toBeDefined();
    });

    it('generates repositories with MongoRepository for MongoDB data sources', async () => {
        const entityRepository = { find: jest.fn(), countDocuments: jest.fn() } as any;
        const dataSource = {
            options: { type: 'mongodb' },
            entityMetadatas: [{ name: TestEntityTarget.name }],
            getRepository: jest.fn(),
            getMongoRepository: jest.fn().mockReturnValue(entityRepository)
        } as any;
        const entityTarget = TestEntityTarget as unknown as new () => TestEntity;
        const generator = createGenerator(new Map([['MONGO', dataSource]]), entityTarget);

        const definitions = await generator.generate();

        expect(dataSource.getMongoRepository).toHaveBeenCalledWith(entityTarget);
        expect(dataSource.getRepository).not.toHaveBeenCalled();
        expect((definitions[0].implementation as any).entityRepository).toBe(entityRepository);
    });

    it('throws when no configured data source contains the entity', async () => {
        class MissingEntity {}
        const entityTarget = MissingEntity as unknown as new () => TestEntity;
        const generator = createGenerator(new Map(), entityTarget);

        await expect(generator.generate()).rejects.toThrow("Entity 'MissingEntity' not found in any registered data source.");
    });
});
