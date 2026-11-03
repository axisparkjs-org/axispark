import { Injectable } from '@axisparkjs/di';
import { DataSource, MongoRepository, ObjectLiteral } from 'typeorm';
import { TransactionContext } from '../transactions/transaction-context';
import { BaseRepository } from './base-repository';
import { ParsedMethod, ParsedPredicate, QueryMethodParser } from './query-method-parser';

/** Executes derived repository methods as MongoDB filters using TypeORM's `MongoRepository`. */
@Injectable()
export class MongoQueryEngine {
    constructor(private readonly queryMethodParser: QueryMethodParser) {}

    /**
     * Parses and executes a derived method against a MongoDB repository.
     *
     * @param _object Repository proxy target supplied by the executable interface.
     * @param property Derived method name, for example `findByStatus`.
     * @param classArgs Mongo repository and owning data source constructor arguments. Inside a transaction
     * of that data source, the query runs on the transactional repository.
     * @param methodArgs Predicate values, optionally followed by a `PageRequest`.
     */
    public async execute<T extends ObjectLiteral>(_object: BaseRepository<T>, property: string, classArgs: unknown[], methodArgs: unknown[]): Promise<unknown> {
        const [defaultEntityRepository, dataSource] = classArgs as [MongoRepository<T>, DataSource];
        const entityRepository =
            defaultEntityRepository && dataSource ? TransactionContext.resolveRepository(defaultEntityRepository, dataSource) : defaultEntityRepository;
        if (!entityRepository || typeof entityRepository.find !== 'function' || typeof entityRepository.countDocuments !== 'function') {
            throw new Error('A TypeORM MongoRepository must be the first repository constructor argument for MongoDB queries.');
        }

        const parsed = this.queryMethodParser.parse(entityRepository, property);
        const { methodArgs: predicateArgs, pageRequest } = this.queryMethodParser.extractPageRequest(parsed.operation, methodArgs);
        if (parsed.order.length > 0 && (parsed.operation === 'count' || parsed.operation === 'exists')) {
            throw new Error(`OrderBy is not supported for '${property}'.`);
        }

        const filter = this.buildFilter(parsed, predicateArgs);
        const order = Object.fromEntries(parsed.order.map(({ propertyPath, direction }) => [propertyPath, direction]));
        const options = {
            where: filter,
            ...(parsed.order.length > 0 ? { order } : {}),
            ...(pageRequest ? { skip: pageRequest.page * pageRequest.size, take: pageRequest.size } : {})
        };

        switch (parsed.operation) {
            case 'findMany':
                return entityRepository.find(options as any);
            case 'findOne':
                return entityRepository.findOne(options as any);
            case 'count':
                return entityRepository.countDocuments(filter);
            case 'exists':
                return (await entityRepository.countDocuments(filter)) > 0;
        }
    }

    private buildFilter(parsed: ParsedMethod, methodArgs: unknown[]): Record<string, unknown> {
        const expectedArgs = parsed.predicateGroups.flat().reduce((total, predicate) => total + predicate.arity, 0);
        if (methodArgs.length !== expectedArgs) {
            throw new Error(`Derived query expected ${expectedArgs} argument(s), received ${methodArgs.length}.`);
        }

        let argIndex = 0;
        const groups = parsed.predicateGroups.map((group) => ({
            $and: group.map((predicate) => this.toMongoPredicate(predicate, methodArgs, () => argIndex++))
        }));
        return groups.length === 1 ? groups[0] : { $or: groups };
    }

    private toMongoPredicate(predicate: ParsedPredicate, methodArgs: unknown[], nextArg: () => number): Record<string, unknown> {
        const { propertyPath, operator } = predicate;
        const value = predicate.arity > 0 ? methodArgs[nextArg()] : undefined;
        switch (operator) {
            case 'IsNull':
                return { [propertyPath]: null };
            case 'IsNotNull':
                return { [propertyPath]: { $ne: null } };
            case 'GreaterThan':
                return { [propertyPath]: { $gt: value } };
            case 'GreaterThanEqual':
                return { [propertyPath]: { $gte: value } };
            case 'LessThan':
                return { [propertyPath]: { $lt: value } };
            case 'LessThanEqual':
                return { [propertyPath]: { $lte: value } };
            case 'Between': {
                const upperBound = methodArgs[nextArg()];
                return { [propertyPath]: { $gte: value, $lte: upperBound } };
            }
            case 'In':
                return { [propertyPath]: { $in: value } };
            case 'Like':
                return { [propertyPath]: this.toLikeRegex(value) };
            default:
                return { [propertyPath]: value };
        }
    }

    private toLikeRegex(value: unknown): RegExp {
        if (typeof value !== 'string') throw new Error('Like operator requires a string argument.');
        const escaped = value
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/%/g, '.*')
            .replace(/_/g, '.');
        return new RegExp(`^${escaped}$`);
    }
}
