import { ObjectLiteral, Repository } from 'typeorm';
import { ParsedMethod, QueryMethodParser } from './query-method-parser';

interface TestEntity extends ObjectLiteral {
    id: number;
    name: string;
    nameFirst: string;
    status: string;
    age: number;
    email: string;
    createdAt: Date;
}

describe('QueryMethodParser', () => {
    let parser: QueryMethodParser;
    let repository: Repository<TestEntity>;

    beforeEach(() => {
        parser = new QueryMethodParser();
        repository = {
            metadata: {
                columns: ['id', 'name', 'nameFirst', 'status', 'age', 'email', 'createdAt'].map((propertyName) => ({
                    propertyName,
                    propertyPath: propertyName
                }))
            }
        } as unknown as Repository<TestEntity>;
    });

    it.each([
        ['findByStatus', 'findMany'],
        ['findOneByStatus', 'findOne'],
        ['countByStatus', 'count'],
        ['existsByStatus', 'exists']
    ])('maps %s to %s', (methodName, operation) => {
        expect(parser.parse(repository, methodName as string)).toMatchObject({
            operation,
            predicateGroups: [[{ propertyPath: 'status', operator: 'Equal', arity: 1 }]],
            order: []
        });
    });

    it('parses predicates, operators, AND precedence, OR groups, and multiple order fields', () => {
        const parsed = parser.parse(repository, 'findByStatusAndAgeGreaterThanOrEmailLikeOrderByCreatedAtDescAndNameAsc');

        expect(parsed).toEqual<ParsedMethod>({
            operation: 'findMany',
            predicateGroups: [
                [
                    { propertyPath: 'status', operator: 'Equal', arity: 1 },
                    { propertyPath: 'age', operator: 'GreaterThan', arity: 1 }
                ],
                [{ propertyPath: 'email', operator: 'Like', arity: 1 }]
            ],
            order: [
                { propertyPath: 'createdAt', direction: 'DESC' },
                { propertyPath: 'name', direction: 'ASC' }
            ]
        });
    });

    it('parses all supported operator suffixes and their argument arity', () => {
        const operators = [
            ['IdIsNotNull', 'IsNotNull', 0],
            ['IdIsNull', 'IsNull', 0],
            ['AgeGreaterThanEqual', 'GreaterThanEqual', 1],
            ['AgeLessThanEqual', 'LessThanEqual', 1],
            ['AgeGreaterThan', 'GreaterThan', 1],
            ['AgeLessThan', 'LessThan', 1],
            ['AgeBetween', 'Between', 2],
            ['IdIn', 'In', 1],
            ['NameLike', 'Like', 1]
        ] as const;

        for (const [suffix, operator, arity] of operators) {
            expect(parser.parse(repository, `findBy${suffix}`).predicateGroups[0][0]).toEqual({
                propertyPath: suffix.startsWith('Age') ? 'age' : suffix.startsWith('Name') ? 'name' : 'id',
                operator,
                arity
            });
        }
    });

    it('prefers the longest matching property and falls back to propertyName metadata', () => {
        expect(parser.parse(repository, 'findByNameFirst').predicateGroups[0][0].propertyPath).toBe('nameFirst');
        repository.metadata.columns[0] = { propertyName: 'id' } as any;
        expect(parser.parse(repository, 'findById').predicateGroups[0][0].propertyPath).toBe('id');
    });

    it('converts dotted paths to method name tags', () => {
        expect(parser.toPropertyTag('profile.education.level')).toBe('ProfileEducationLevel');
    });

    it('rejects unsupported methods, empty predicates, and unknown properties or operators', () => {
        expect(() => parser.parse(repository, 'removeByStatus')).toThrow("Unsupported derived repository method 'removeByStatus'.");
        expect(() => parser.parse(repository, 'findByOrderByName')).toThrow('at least one property after');
        expect(() => parser.parse(repository, 'findByMissingField')).toThrow("Cannot parse 'MissingField'");
        expect(() => parser.parse(repository, 'findByNameUnsupported')).toThrow("Cannot parse 'NameUnsupported'");
    });

    it('rejects malformed OR and AND predicate groups', () => {
        expect(() => parser.parse(repository, 'findByStatusOrOrEmail')).toThrow('Empty OR clause');
        expect(() => parser.parse(repository, 'findByStatusAndAndEmail')).toThrow('Empty AND clause');
    });

    it('rejects invalid OrderBy clauses and directions', () => {
        expect(() => parser.parse(repository, 'findByStatusOrderBy')).toThrow('must be followed by at least one property');
        expect(() => parser.parse(repository, 'findByStatusOrderByMissingField')).toThrow("Cannot parse order field 'MissingField'");
        expect(() => parser.parse(repository, 'findByStatusOrderByNameRandom')).toThrow("Cannot parse order field 'NameRandom'");
        expect(() => parser.parse(repository, 'findByStatusOrderByNameAnd')).toThrow('Empty order field');
        expect(() => parser.parse(repository, 'findByStatusOrderByNameAscOrderByIdAsc')).toThrow('Only one OrderBy clause');
        expect(parser.parse(repository, 'findByStatusOrderByName').order).toEqual([{ propertyPath: 'name', direction: 'ASC' }]);
    });

    describe('property names that contain keywords', () => {
        beforeEach(() => {
            repository = {
                metadata: {
                    columns: ['status', 'originCountry', 'orderId', 'androidVersion', 'customerOrdersCount', 'brandAndroid', 'orderByDate', 'brand.origin'].map(
                        (propertyPath) => ({ propertyName: propertyPath.split('.').pop(), propertyPath })
                    )
                }
            } as unknown as Repository<TestEntity>;
        });

        it.each([
            ['findByOriginCountry', 'originCountry'],
            ['findByOrderId', 'orderId'],
            ['findByAndroidVersion', 'androidVersion'],
            ['findByCustomerOrdersCount', 'customerOrdersCount'],
            ['findByOrderByDate', 'orderByDate'],
            ['findByBrandOrigin', 'brand.origin']
        ])('parses %s as a single predicate', (methodName, propertyPath) => {
            expect(parser.parse(repository, methodName)).toEqual<ParsedMethod>({
                operation: 'findMany',
                predicateGroups: [[{ propertyPath, operator: 'Equal', arity: 1 }]],
                order: []
            });
        });

        it('still reads And, Or and OrderBy as keywords between properties', () => {
            expect(parser.parse(repository, 'findByOriginCountryOrStatus').predicateGroups).toEqual([
                [{ propertyPath: 'originCountry', operator: 'Equal', arity: 1 }],
                [{ propertyPath: 'status', operator: 'Equal', arity: 1 }]
            ]);
            expect(parser.parse(repository, 'findByStatusOrOrderIdInAndAndroidVersionGreaterThan').predicateGroups).toEqual([
                [{ propertyPath: 'status', operator: 'Equal', arity: 1 }],
                [
                    { propertyPath: 'orderId', operator: 'In', arity: 1 },
                    { propertyPath: 'androidVersion', operator: 'GreaterThan', arity: 1 }
                ]
            ]);
        });

        it('parses order fields that contain keywords', () => {
            expect(parser.parse(repository, 'findByStatusOrderByBrandAndroidAsc')).toEqual<ParsedMethod>({
                operation: 'findMany',
                predicateGroups: [[{ propertyPath: 'status', operator: 'Equal', arity: 1 }]],
                order: [{ propertyPath: 'brandAndroid', direction: 'ASC' }]
            });
            expect(parser.parse(repository, 'findByOrderIdOrderByOrderByDateDescAndOriginCountry').order).toEqual([
                { propertyPath: 'orderByDate', direction: 'DESC' },
                { propertyPath: 'originCountry', direction: 'ASC' }
            ]);
        });

        it('tries a shorter property when the longest match cannot be continued', () => {
            repository.metadata.columns.push({ propertyName: 'statusOrder', propertyPath: 'statusOrder' } as any);

            expect(parser.parse(repository, 'findByStatusOrderByOrderId')).toEqual<ParsedMethod>({
                operation: 'findMany',
                predicateGroups: [[{ propertyPath: 'status', operator: 'Equal', arity: 1 }]],
                order: [{ propertyPath: 'orderId', direction: 'ASC' }]
            });
            expect(parser.parse(repository, 'findByStatusOrder').predicateGroups).toEqual([[{ propertyPath: 'statusOrder', operator: 'Equal', arity: 1 }]]);
        });

        it('keeps the error messages for invalid method names', () => {
            expect(() => parser.parse(repository, 'findByOriginCity')).toThrow("Cannot parse 'OriginCity' in derived query 'findByOriginCity'.");
            expect(() => parser.parse(repository, 'findByStatusOrOriginCity')).toThrow("Cannot parse 'OriginCity'");
            expect(() => parser.parse(repository, 'findByOrStatus')).toThrow('Empty OR clause');
            expect(() => parser.parse(repository, 'findByAndStatus')).toThrow('Empty AND clause');
            expect(() => parser.parse(repository, 'findByStatusOr')).toThrow('Empty OR clause');
            expect(() => parser.parse(repository, 'findByStatusAnd')).toThrow('Empty AND clause');
            expect(() => parser.parse(repository, 'findByStatusAndOrderByOrderId')).toThrow('Empty AND clause');
            expect(() => parser.parse(repository, 'findByStatusOrderByOriginCity')).toThrow("Cannot parse order field 'OriginCity'");
            expect(() => parser.parse(repository, 'findByStatusOrderByAndOrderId')).toThrow('Empty order field');
            expect(() => parser.parse(repository, 'findByStatusOrderByOrderIdOrderByStatus')).toThrow('Only one OrderBy clause');
        });
    });

    it('extracts a valid page request and leaves ordinary method arguments untouched', () => {
        const args = ['active', { page: 2, size: 10 }];
        expect(parser.extractPageRequest('findMany', args)).toEqual({ methodArgs: ['active'], pageRequest: { page: 2, size: 10 } });
        expect(parser.extractPageRequest('findMany', ['active'])).toEqual({ methodArgs: ['active'] });
        expect(parser.extractPageRequest('findMany', [])).toEqual({ methodArgs: [] });
        expect(parser.extractPageRequest('findMany', ['active', null])).toEqual({ methodArgs: ['active', null] });
    });

    it('rejects invalid page values and page requests on non-list operations', () => {
        expect(() => parser.extractPageRequest('findMany', [{ page: -1, size: 10 }])).toThrow('PageRequest requires');
        expect(() => parser.extractPageRequest('findMany', [{ page: 0, size: 0 }])).toThrow('PageRequest requires');
        expect(() => parser.extractPageRequest('findMany', [{ page: 1.5, size: 10 }])).toThrow('PageRequest requires');
        expect(() => parser.extractPageRequest('findOne', [{ page: 0, size: 10 }])).toThrow('only supported by findBy');
    });
});
