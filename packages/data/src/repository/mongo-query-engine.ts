import { Injectable } from '@axisparkjs/di';
import { DataSource, MongoRepository, ObjectLiteral } from 'typeorm';
import { TransactionContext } from '../transactions/transaction-context';
import { BaseRepository } from './base-repository';
import { ParsedMethod, ParsedPredicate, QueryMethodParser, toPage } from './query-method-parser';

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
     * @param methodArgs Predicate values, optionally followed by a `PageRequest`. A `findBy` method with a `PageRequest`
     * resolves with a `Page`, and a `deleteBy` method with the number of deleted documents.
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
        if (parsed.order.length > 0 && (parsed.operation === 'count' || parsed.operation === 'exists' || parsed.operation === 'delete')) {
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
            case 'findMany': {
                if (!pageRequest) return entityRepository.find(options as any);
                const [content, total] = await Promise.all([entityRepository.find(options as any), entityRepository.countDocuments(filter)]);
                return toPage(content, total, pageRequest);
            }
            case 'findOne':
                return entityRepository.findOne(options as any);
            case 'count':
                return entityRepository.countDocuments(filter);
            case 'exists':
                return (await entityRepository.countDocuments(filter)) > 0;
            case 'delete':
                return (await entityRepository.deleteMany(filter)).deletedCount ?? 0;
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
        const { propertyPath, operator, ignoreCase } = predicate;
        const value = predicate.arity > 0 ? methodArgs[nextArg()] : undefined;
        switch (operator) {
            case 'True':
                return { [propertyPath]: true };
            case 'False':
                return { [propertyPath]: false };
            case 'Not':
                return { [propertyPath]: ignoreCase ? { $not: this.toRegex(value, operator, '^', '$', true) } : { $ne: value } };
            case 'NotIn':
                return { [propertyPath]: { $nin: value } };
            case 'Containing':
                return { [propertyPath]: this.toRegex(value, operator, '', '', ignoreCase) };
            case 'StartingWith':
                return { [propertyPath]: this.toRegex(value, operator, '^', '', ignoreCase) };
            case 'EndingWith':
                return { [propertyPath]: this.toRegex(value, operator, '', '$', ignoreCase) };
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
                return { [propertyPath]: this.toLikeRegex(value, ignoreCase) };
            default:
                return { [propertyPath]: ignoreCase ? this.toRegex(value, 'Equal', '^', '$', true) : value };
        }
    }

    private toLikeRegex(value: unknown, ignoreCase?: boolean): RegExp {
        if (typeof value !== 'string') throw new Error('Like operator requires a string argument.');
        const escaped = escapeRegex(value).replace(/%/g, '.*').replace(/_/g, '.');
        return new RegExp(`^${escaped}$`, ignoreCase ? 'i' : '');
    }

    /** Builds a regular expression that matches the value literally, between `start` and `end`. */
    private toRegex(value: unknown, operator: string, start: string, end: string, ignoreCase: boolean | undefined): RegExp {
        if (typeof value !== 'string') throw new Error(`${operator} operator requires a string argument.`);
        return new RegExp(`${start}${escapeRegex(value)}${end}`, ignoreCase ? 'i' : '');
    }
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
