import { Injectable } from '@axisparkjs/di';
import { Brackets, DataSource, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { TransactionContext } from '../transactions/transaction-context';
import { BaseRepository } from './base-repository';
import { ParsedMethod, ParsedPredicate, QueryMethodParser, toPage } from './query-method-parser';

/** Executes derived repository methods by building TypeORM SQL `SelectQueryBuilder` queries. */
@Injectable()
export class SQLQueryEngine {
    constructor(private readonly queryMethodParser: QueryMethodParser) {}

    /**
     * Parses and executes a derived method against a relational TypeORM repository.
     *
     * @param _object Repository proxy target supplied by the executable interface.
     * @param property Derived method name, for example `findByStatus`.
     * @param classArgs Repository and owning data source constructor arguments. Inside a transaction of
     * that data source, the query runs on the transactional repository.
     * @param methodArgs Predicate values, optionally followed by a `PageRequest`. A `findBy` method with a `PageRequest`
     * resolves with a `Page`, and a `deleteBy` method with the number of deleted entities.
     */
    public async execute<T extends ObjectLiteral>(_object: BaseRepository<T>, property: string, classArgs: unknown[], methodArgs: unknown[]): Promise<unknown> {
        const [defaultEntityRepository, dataSource] = classArgs as [Repository<T>, DataSource];
        const entityRepository =
            defaultEntityRepository && dataSource ? TransactionContext.resolveRepository(defaultEntityRepository, dataSource) : defaultEntityRepository;
        if (!entityRepository || typeof entityRepository.createQueryBuilder !== 'function') {
            throw new Error('A TypeORM Repository must be the first repository constructor argument.');
        }

        const parsed = this.queryMethodParser.parse(entityRepository, property);
        const { methodArgs: predicateArgs, pageRequest } = this.queryMethodParser.extractPageRequest(parsed.operation, methodArgs);
        if (parsed.order.length > 0 && (parsed.operation === 'count' || parsed.operation === 'exists' || parsed.operation === 'delete')) {
            throw new Error(`OrderBy is not supported for '${property}'.`);
        }

        const query = entityRepository.createQueryBuilder('entity');
        this.applyPredicates(query, parsed.predicateGroups, predicateArgs);
        this.applyOrder(query, parsed.order);
        if (pageRequest) query.skip(pageRequest.page * pageRequest.size).take(pageRequest.size);

        switch (parsed.operation) {
            case 'findMany':
                if (!pageRequest) return query.getMany();
                return toPage(...(await query.getManyAndCount()), pageRequest);
            case 'findOne':
                return query.getOne();
            case 'count':
                return query.getCount();
            case 'exists':
                return (await query.getCount()) > 0;
            case 'delete':
                return this.deleteMatching(entityRepository, query);
        }
    }

    /**
     * Deletes the entities that match the query. The primary keys are selected with the predicates of the method, and the
     * entities are deleted by primary key, so the predicates can use any property path in every SQL driver.
     */
    private async deleteMatching<T extends ObjectLiteral>(repository: Repository<T>, query: SelectQueryBuilder<T>): Promise<number> {
        query.select(repository.metadata.primaryColumns.map((column) => `entity.${column.propertyPath}`));
        const entities = await query.getMany();
        if (entities.length === 0) return 0;

        const result = await repository.delete(entities.map((entity) => repository.getId(entity)));
        return result.affected ?? entities.length;
    }

    private applyPredicates<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, groups: ParsedPredicate[][], methodArgs: unknown[]): void {
        const expectedArgs = groups.flat().reduce((total, predicate) => total + predicate.arity, 0);
        if (methodArgs.length !== expectedArgs) {
            throw new Error(`Derived query expected ${expectedArgs} argument(s), received ${methodArgs.length}.`);
        }

        let argIndex = 0;
        let constantIndex = 0;
        groups.forEach((group, groupIndex) => {
            const bracket = new Brackets((where) => {
                group.forEach((predicate, predicateIndex) => {
                    const parameters: Record<string, unknown> = {};
                    // The predicates without arguments (True and False) bind their value with a name of their own.
                    const names =
                        predicate.arity === 0
                            ? [`queryConst${constantIndex++}`]
                            : Array.from({ length: predicate.arity }, (_, offset) => `queryArg${argIndex + offset}`);
                    const values = methodArgs.slice(argIndex, argIndex + predicate.arity);
                    argIndex += predicate.arity;

                    const expression = this.toSql(`entity.${predicate.propertyPath}`, predicate, names, values, parameters);
                    if (predicateIndex === 0) where.where(expression, parameters);
                    else where.andWhere(expression, parameters);
                });
            });

            if (groupIndex === 0) query.where(bracket);
            else query.orWhere(bracket);
        });
    }

    /** Builds the SQL expression of a predicate, and sets its parameters with the given names. */
    private toSql(column: string, { operator, ignoreCase }: ParsedPredicate, names: string[], values: unknown[], parameters: Record<string, unknown>): string {
        const [name] = names;
        const value = values[0];
        const parameter = (parameterValue: unknown = value, parameterName = name) => {
            parameters[parameterName] = parameterValue;
            return `:${parameterName}`;
        };
        const lower = (expression: string) => (ignoreCase ? `LOWER(${expression})` : expression);

        switch (operator) {
            case 'IsNotNull':
                return `${column} IS NOT NULL`;
            case 'IsNull':
                return `${column} IS NULL`;
            case 'True':
                return `${column} = ${parameter(true)}`;
            case 'False':
                return `${column} = ${parameter(false)}`;
            case 'GreaterThanEqual':
                return `${column} >= ${parameter()}`;
            case 'LessThanEqual':
                return `${column} <= ${parameter()}`;
            case 'GreaterThan':
                return `${column} > ${parameter()}`;
            case 'LessThan':
                return `${column} < ${parameter()}`;
            case 'Between':
                return `${column} BETWEEN ${parameter()} AND ${parameter(values[1], names[1])}`;
            case 'In':
            case 'NotIn':
                // An empty list matches nothing with In and everything with NotIn, instead of the invalid `IN ()`.
                if (Array.isArray(value) && value.length === 0) return operator === 'In' ? '1 = 0' : '1 = 1';
                parameters[name] = value;
                return `${column} ${operator === 'In' ? 'IN' : 'NOT IN'} (:...${name})`;
            case 'Like':
                return `${lower(column)} LIKE ${lower(parameter())}`;
            case 'Containing':
                return `${lower(column)} LIKE ${lower(parameter(`%${escapeLike(value, operator)}%`))} ESCAPE '${LIKE_ESCAPE}'`;
            case 'StartingWith':
                return `${lower(column)} LIKE ${lower(parameter(`${escapeLike(value, operator)}%`))} ESCAPE '${LIKE_ESCAPE}'`;
            case 'EndingWith':
                return `${lower(column)} LIKE ${lower(parameter(`%${escapeLike(value, operator)}`))} ESCAPE '${LIKE_ESCAPE}'`;
            case 'Not':
                return `${lower(column)} <> ${lower(parameter())}`;
            default:
                return `${lower(column)} = ${lower(parameter())}`;
        }
    }

    private applyOrder<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, order: ParsedMethod['order']): void {
        order.forEach(({ propertyPath, direction }, index) => {
            const column = `entity.${propertyPath}`;
            if (index === 0) query.orderBy(column, direction);
            else query.addOrderBy(column, direction);
        });
    }
}

/**
 * The escape character of the `LIKE` patterns built for `Containing`, `StartingWith` and `EndingWith`. A character other
 * than the backslash is used because the backslash is itself an escape character in the strings of MySQL.
 */
const LIKE_ESCAPE = '!';

/** Escapes the wildcards of a `LIKE` pattern, so `%` and `_` in the value are matched literally. */
function escapeLike(value: unknown, operator: string): string {
    if (typeof value !== 'string') throw new Error(`${operator} operator requires a string argument.`);
    return value.replace(/[!%_]/g, (character) => `${LIKE_ESCAPE}${character}`);
}
