import {
    ArrayMaxSize,
    ArrayMinSize,
    ArrayNotEmpty,
    ArrayUnique,
    Equals,
    IsArray,
    IsBoolean,
    IsBooleanString,
    IsDate,
    IsDateString,
    IsDivisibleBy,
    IsEmail,
    IsEnum,
    IsIn,
    IsInt,
    IsISO8601,
    IsNegative,
    IsNotEmpty,
    IsNotEmptyObject,
    IsNumber,
    IsNumberString,
    IsObject,
    IsOptional,
    IsPositive,
    IsString,
    IsUrl,
    IsUUID,
    Length,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateIf,
    ValidateNested
} from 'class-validator';
import { McpSchemaGenerator } from './mcp-schema-generator';

enum Color {
    Red = 'red',
    Blue = 'blue'
}
enum Level {
    Low,
    High
}

class AddressDto {
    @IsString()
    street: string;
}

class TreeDto {
    @IsString()
    name: string;

    @IsOptional()
    @ValidateNested()
    parent?: TreeDto;
}

class CompleteDto {
    @IsString() @MinLength(2) @MaxLength(10) @IsNotEmpty() name: string;
    @IsString() @Length(1, 5) code: string;
    @IsString() @Length(3) short: string;
    @IsString() @Matches(/^[a-z]+$/) slug: string;
    @Matches('^x') prefixed: string;
    @IsInt() @Min(1) @Max(9) count: number;
    @IsNumber() @IsPositive() @IsDivisibleBy(2) even: number;
    @IsNumber() @IsNegative() negative: number;
    @IsBoolean() active: boolean;
    @IsEmail() email: string;
    @IsUrl() url: string;
    @IsUUID() id: string;
    @IsDate() createdAt: Date;
    @IsDateString() updatedAt: string;
    @IsISO8601() deletedAt: string;
    @IsNumberString() amount: string;
    @IsBooleanString() flag: string;
    @IsEnum(Color) color: Color;
    @IsEnum(Level) level: Level;
    @IsIn(['a', 'b']) letter: string;
    @Equals('fixed') constant: string;
    @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @ArrayUnique() @IsString({ each: true }) tags: string[];
    @ArrayNotEmpty() values: number[];
    @IsObject() meta: Record<string, unknown>;
    @IsNotEmptyObject() options: Record<string, unknown>;
    @ValidateNested() address: AddressDto;
    @ValidateNested({ each: true }) addresses: AddressDto[];
    @ValidateNested() untyped: unknown;
    @IsOptional() @IsString() optional?: string;
    @ValidateIf(() => false) @IsString() conditional?: string;
}

describe('McpSchemaGenerator', () => {
    const generator = new McpSchemaGenerator();

    it('should generate an open object schema without a class', () => {
        expect(generator.generate()).toEqual({ type: 'object' });
        expect(generator.generate(String)).toEqual({ type: 'object' });
        expect(generator.generate(Object)).toEqual({ type: 'object' });
    });

    it('should detect the types that can generate a schema', () => {
        expect(generator.isSchemaType(CompleteDto)).toBe(true);
        expect(generator.isSchemaType(Array)).toBe(false);
        expect(generator.isSchemaType(undefined)).toBe(false);
    });

    it('should generate an object schema without properties for a class without validation metadata', () => {
        class EmptyDto {}

        expect(generator.generate(EmptyDto)).toEqual({ type: 'object', properties: {} });
    });

    it('should generate the schema of every supported validator', () => {
        const schema = generator.generate(CompleteDto);

        expect(schema.properties).toEqual({
            name: { type: 'string', minLength: 2, maxLength: 10 },
            code: { type: 'string', minLength: 1, maxLength: 5 },
            short: { type: 'string', minLength: 3 },
            slug: { type: 'string', pattern: '^[a-z]+$' },
            prefixed: { type: 'string', pattern: '^x' },
            count: { type: 'integer', minimum: 1, maximum: 9 },
            even: { type: 'number', exclusiveMinimum: 0, multipleOf: 2 },
            negative: { type: 'number', exclusiveMaximum: 0 },
            active: { type: 'boolean' },
            email: { type: 'string', format: 'email' },
            url: { type: 'string', format: 'uri' },
            id: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            deletedAt: { type: 'string', format: 'date-time' },
            amount: { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' },
            flag: { type: 'string', enum: ['true', 'false', '1', '0'] },
            color: { type: 'string', enum: ['red', 'blue'] },
            level: { type: 'number', enum: [0, 1] },
            letter: { type: 'string', enum: ['a', 'b'] },
            constant: { type: 'string', const: 'fixed' },
            tags: { type: 'array', minItems: 1, maxItems: 3, uniqueItems: true, items: { type: 'string' } },
            values: { type: 'array', minItems: 1 },
            meta: { type: 'object' },
            options: { type: 'object', minProperties: 1 },
            address: { type: 'object', properties: { street: { type: 'string' } }, required: ['street'] },
            addresses: { type: 'array', items: { type: 'object' } },
            untyped: { type: 'object' },
            optional: { type: 'string' },
            conditional: { type: 'string' }
        });
        expect(schema.required).toEqual(expect.arrayContaining(['name', 'tags', 'address']));
        expect(schema.required).not.toContain('optional');
        expect(schema.required).not.toContain('conditional');
    });

    it('should stop on recursive classes', () => {
        expect(generator.generate(TreeDto)).toEqual({
            type: 'object',
            properties: { name: { type: 'string' }, parent: { type: 'object' } },
            required: ['name']
        });
    });

    it('should describe nested arrays without an item type as arrays of objects', () => {
        class NestedArrayDto {
            @IsArray() @ValidateNested() items: AddressDto[];
        }

        expect(generator.generate(NestedArrayDto).properties).toEqual({ items: { type: 'array', items: { type: 'object' } } });
    });

    it('should not add a minimum length to non string values', () => {
        class NotEmptyDto {
            @IsNotEmpty() value: number;
            @IsIn(undefined as never) other: string;
        }

        expect(generator.generate(NotEmptyDto).properties).toEqual({ value: { type: 'number' }, other: { type: 'string', enum: [] } });
    });
});
