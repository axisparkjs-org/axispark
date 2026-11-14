import { DataSource, EntityManager, FindManyOptions, In, MongoRepository, ObjectLiteral, RemoveOptions, Repository } from 'typeorm';
import { TransactionContext } from '../transactions/transaction-context';
import { Page, PageRequest, toPage, validatePageRequest } from './query-method-parser';

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

    /**
     * Finds one page of the entities matching TypeORM find options, with the total of every page. The `skip` and `take`
     * of the options are replaced by the page request.
     */
    async findPage(options: FindManyOptions<T> | undefined, pageRequest: PageRequest): Promise<Page<T>> {
        const { page, size } = validatePageRequest(pageRequest);
        const [content, total] = await this.entityRepository.findAndCount({ ...options, skip: page * size, take: size });
        return toPage(content, total, { page, size });
    }

    /**
     * Finds the entity with a primary key, or resolves with `null` when it does not exist. With a composite primary key,
     * give an object with every primary column. In MongoDB, a string with the hexadecimal form of an `ObjectId` is
     * converted to an `ObjectId`.
     */
    async findById(id: unknown): Promise<T | null> {
        if (this.isMongo()) return (this.entityRepository as MongoRepository<T>).findOne({ where: this.mongoIdFilter(id) } as any);
        return this.entityRepository.findOne({ where: this.idCriteria(id) });
    }

    /** Finds the entities with any of the primary keys. Missing keys are ignored, and the order of the result is not guaranteed. */
    async findByIds(ids: unknown[]): Promise<T[]> {
        if (ids.length === 0) return [];
        if (this.isMongo()) {
            const column = this.objectIdColumnName();
            return (this.entityRepository as MongoRepository<T>).find({ where: { [column]: { $in: ids.map((id) => this.toObjectId(id)) } } } as any);
        }

        const primaryColumns = this.entityRepository.metadata.primaryColumns;
        const where = primaryColumns.length === 1 ? primaryColumns[0].createValueMap(In(ids)) : ids.map((id) => this.idCriteria(id));
        return this.entityRepository.find({ where: where as any });
    }

    /** Returns whether an entity with the primary key exists. */
    async existsById(id: unknown): Promise<boolean> {
        if (this.isMongo()) return (await (this.entityRepository as MongoRepository<T>).countDocuments(this.mongoIdFilter(id))) > 0;
        return this.entityRepository.exists({ where: this.idCriteria(id) });
    }

    /** Deletes the entity with the primary key and resolves with the number of deleted entities, `0` when it does not exist. */
    async deleteById(id: unknown): Promise<number> {
        if (this.isMongo()) return (await (this.entityRepository as MongoRepository<T>).deleteOne(this.mongoIdFilter(id))).deletedCount ?? 0;

        const result = await this.entityRepository.delete(this.idCriteria(id) as any);
        return result.affected ?? 0;
    }

    private isMongo(): boolean {
        return this.dataSource.options.type === 'mongodb';
    }

    /** Builds the `where` of a primary key from the primary columns of the entity metadata, so it works with any column name. */
    private idCriteria(id: unknown): any {
        return this.entityRepository.metadata.ensureEntityIdMap(id);
    }

    private objectIdColumnName(): string {
        const metadata = this.entityRepository.metadata;
        return metadata.objectIdColumn?.databaseName ?? metadata.primaryColumns[0]?.databaseName ?? '_id';
    }

    private mongoIdFilter(id: unknown): Record<string, unknown> {
        return { [this.objectIdColumnName()]: this.toObjectId(id) };
    }

    private toObjectId(id: unknown): unknown {
        const ObjectId = (this.dataSource.driver as unknown as { mongodb?: { ObjectId?: new (id: string) => unknown } }).mongodb?.ObjectId;
        if (ObjectId && this.entityRepository.metadata.objectIdColumn && typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id)) return new ObjectId(id);
        return id;
    }
}
