import { DataSource, EntityManager, FindManyOptions, ObjectLiteral, RemoveOptions, Repository } from 'typeorm';
import { TransactionContext } from '../transactions/transaction-context';

/**
 * Shared TypeORM-backed repository operations. Extend this class from a class
 * decorated with `@Repository({ entity })` to add application-specific methods
 * and declare generated query methods.
 *
 * Inside a transaction opened with `@Transactional` or `TransactionManager`,
 * every operation runs on the transaction of the repository's data source.
 */
export abstract class BaseRepository<T extends ObjectLiteral> {
    private readonly defaultEntityRepository: Repository<T>;

    protected constructor(
        entityRepository: Repository<T>,
        /** Data source that owns the decorated entity. */
        protected readonly dataSource: DataSource
    ) {
        this.defaultEntityRepository = entityRepository;
    }

    /**
     * TypeORM repository selected for the decorated entity. Inside a transaction
     * of the repository's data source, it is bound to that transaction.
     */
    protected get entityRepository(): Repository<T> {
        return TransactionContext.resolveRepository<T, Repository<T>>(this.defaultEntityRepository, this.dataSource);
    }

    /**
     * Entity manager of the repository's data source. Inside a transaction of
     * that data source, it is the transactional entity manager.
     */
    protected get entityManager(): EntityManager {
        return TransactionContext.getEntityManager(this.dataSource) ?? this.dataSource.manager;
    }

    /** Saves one entity using the configured TypeORM repository. */
    async save(entity: T): Promise<T>;
    /** Saves multiple entities using the configured TypeORM repository. */
    async save(entities: T[]): Promise<T[]>;
    async save(entityOrEntities: T | T[]): Promise<T | T[]> {
        if (Array.isArray(entityOrEntities)) {
            return this.entityRepository.save(entityOrEntities);
        }

        return this.entityRepository.save(entityOrEntities);
    }

    /** Finds entities using TypeORM {@link https://typeorm.io/docs/working-with-entity-manager/find-options/ FindManyOptions}. */
    async find(options?: FindManyOptions<T>): Promise<T[]> {
        return this.entityRepository.find(options);
    }

    /** Counts entities matching TypeORM find options. */
    async count(options?: FindManyOptions<T>): Promise<number> {
        return this.entityRepository.count(options);
    }

    /** Returns whether at least one entity matches TypeORM find options. */
    async exists(options?: FindManyOptions<T>): Promise<boolean> {
        return this.entityRepository.exists(options);
    }

    /** Removes one entity and resolves with the removed entity. */
    async remove(entity: T, options?: RemoveOptions): Promise<T>;
    /** Removes multiple entities and resolves with the removed entities. */
    async remove(entities: T[], options?: RemoveOptions): Promise<T[]>;
    async remove(entityOrEntities: T | T[], options?: RemoveOptions): Promise<T | T[]> {
        if (Array.isArray(entityOrEntities)) {
            return this.entityRepository.remove(entityOrEntities, options);
        }

        return this.entityRepository.remove(entityOrEntities, options);
    }
}
