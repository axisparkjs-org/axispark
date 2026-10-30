import { Injectable } from '@axisparkjs/di';
import { ObjectLiteral, Repository } from 'typeorm';

/** Operation selected by a supported derived method prefix. */
export type QueryOperation = 'findMany' | 'findOne' | 'count' | 'exists';
/** Recognized suffix for a derived predicate. */
export type PredicateOperatorName =
    'Equal' | 'IsNull' | 'IsNotNull' | 'GreaterThanEqual' | 'LessThanEqual' | 'GreaterThan' | 'LessThan' | 'Between' | 'In' | 'Like';

export interface ParsedPredicate {
    /** TypeORM metadata path of the entity property. */
    propertyPath: string;
    /** Comparison operation represented by this predicate. */
    operator: PredicateOperatorName;
    /** Number of method arguments consumed by this predicate. */
    arity: number;
}

/** Normalized structure shared by SQL and Mongo query engines. */
export interface ParsedMethod {
    /** Result operation inferred from the method prefix. */
    operation: QueryOperation;
    // OR groups contain AND-connected predicates: (a AND b) OR (c AND d).
    /** AND-connected predicate groups, combined with OR between groups. */
    predicateGroups: ParsedPredicate[][];
    /** Ordered entity properties requested by the optional `OrderBy` clause. */
    order: { propertyPath: string; direction: 'ASC' | 'DESC' }[];
}

const OPERATORS: { suffix: PredicateOperatorName; arity: number }[] = [
    { suffix: 'IsNotNull', arity: 0 },
    { suffix: 'IsNull', arity: 0 },
    { suffix: 'GreaterThanEqual', arity: 1 },
    { suffix: 'LessThanEqual', arity: 1 },
    { suffix: 'GreaterThan', arity: 1 },
    { suffix: 'LessThan', arity: 1 },
    { suffix: 'Between', arity: 2 },
    { suffix: 'In', arity: 1 },
    { suffix: 'Like', arity: 1 }
];

@Injectable()
/** Parses repository method names and page arguments into a database-neutral query description. */
export class QueryMethodParser {
    /** Parses a supported derived method name against the entity's TypeORM metadata. */
    parse<T extends ObjectLiteral>(repository: Repository<T>, methodName: string): ParsedMethod {
        const methodMatch = /^(findOneBy|findBy|countBy|existsBy)(.+)$/.exec(methodName);
        if (!methodMatch) throw new Error(`Unsupported derived repository method '${methodName}'.`);

        const [, prefix, methodBody] = methodMatch;
        const operation: QueryOperation = prefix === 'findOneBy' ? 'findOne' : prefix === 'findBy' ? 'findMany' : prefix === 'countBy' ? 'count' : 'exists';
        const orderByIndex = methodBody.indexOf('OrderBy');
        const predicateText = orderByIndex < 0 ? methodBody : methodBody.slice(0, orderByIndex);
        const orderText = orderByIndex < 0 ? '' : methodBody.slice(orderByIndex + 'OrderBy'.length);

        if (orderByIndex >= 0 && methodBody.indexOf('OrderBy', orderByIndex + 1) >= 0) {
            throw new Error(`Only one OrderBy clause is allowed in '${methodName}'.`);
        }
        if (orderByIndex >= 0 && !orderText) throw new Error(`OrderBy in '${methodName}' must be followed by at least one property.`);

        return {
            operation,
            predicateGroups: this.parsePredicates(repository, predicateText, methodName),
            order: orderText ? this.parseOrder(repository, orderText, methodName) : []
        };
    }

    /** Removes and validates a final page request argument, when present. */
    extractPageRequest(operation: QueryOperation, methodArgs: unknown[]): { methodArgs: unknown[]; pageRequest?: PageRequest } {
        const candidate = methodArgs[methodArgs.length - 1];
        if (!candidate || typeof candidate !== 'object' || !('page' in candidate) || !('size' in candidate)) return { methodArgs };

        const { page, size } = candidate as PageRequest;
        if (!Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1) {
            throw new Error('PageRequest requires a non-negative integer page and a positive integer size.');
        }
        if (operation !== 'findMany') throw new Error('PageRequest is only supported by findBy methods.');

        return { methodArgs: methodArgs.slice(0, -1), pageRequest: { page, size } };
    }

    /** Converts a metadata property path such as `profile.education` to `ProfileEducation`. */
    toPropertyTag(propertyPath: string): string {
        return propertyPath
            .split('.')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
    }

    private parsePredicates<T extends ObjectLiteral>(repository: Repository<T>, predicateText: string, methodName: string): ParsedPredicate[][] {
        if (!predicateText) throw new Error(`A derived query must include at least one property after 'By' in '${methodName}'.`);

        return predicateText.split('Or').map((orGroup) => {
            if (!orGroup) throw new Error(`Empty OR clause in derived query '${methodName}'.`);
            return orGroup.split('And').map((segment) => {
                if (!segment) throw new Error(`Empty AND clause in derived query '${methodName}'.`);

                const matches = repository.metadata.columns.flatMap((column) => {
                    const propertyPath = column.propertyPath ?? column.propertyName;
                    const propertyTag = this.toPropertyTag(propertyPath);
                    if (!segment.startsWith(propertyTag)) return [];

                    const suffix = segment.slice(propertyTag.length);
                    const operator = suffix ? OPERATORS.find((candidate) => candidate.suffix === suffix) : undefined;
                    if (suffix && !operator) return [];
                    return [{ propertyPath, operator: operator?.suffix ?? 'Equal', arity: operator?.arity ?? 1 }];
                });

                if (matches.length === 0) throw new Error(`Cannot parse '${segment}' in derived query '${methodName}'.`);
                return matches.sort((a, b) => b.propertyPath.length - a.propertyPath.length)[0];
            });
        });
    }

    private parseOrder<T extends ObjectLiteral>(repository: Repository<T>, orderText: string, methodName: string): ParsedMethod['order'] {
        return orderText.split('And').map((segment) => {
            if (!segment) throw new Error(`Empty order field in derived query '${methodName}'.`);

            const matches = repository.metadata.columns.flatMap((column) => {
                const propertyPath = column.propertyPath ?? column.propertyName;
                const propertyTag = this.toPropertyTag(propertyPath);
                if (!segment.startsWith(propertyTag)) return [];
                const directionText = segment.slice(propertyTag.length);
                if (directionText && directionText !== 'Asc' && directionText !== 'Desc') return [];
                return [{ propertyPath, direction: directionText === 'Desc' ? ('DESC' as const) : ('ASC' as const) }];
            });

            if (matches.length === 0) throw new Error(`Cannot parse order field '${segment}' in derived query '${methodName}'.`);
            return matches.sort((a, b) => b.propertyPath.length - a.propertyPath.length)[0];
        });
    }
}

export interface PageRequest {
    /** Zero-based page index. */
    page: number;
    /** Number of entities to return per page. Must be greater than zero. */
    size: number;
}
