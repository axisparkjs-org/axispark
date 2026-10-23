import { IsEmail, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { ValidateSchema, ValidateSchemaPipeStep } from './validate-schema';
import { PipeStepError, PipeStepValidationError } from '../../pipe';
import { ParameterDefinition } from '../../parameter';
import { Pipe } from '../../decorators';

class AddressDto {
    @IsString()
    city!: string;
}

class CreateUserDto {
    @IsEmail()
    email!: string;

    @IsInt({ groups: ['admin'] })
    @Min(18)
    age!: number;

    @ValidateNested()
    address?: AddressDto;
}

interface UserLike {
    email: string;
}

class Controller {
    create(@Pipe(ValidateSchema()) _user: CreateUserDto): void {}
    untyped(@Pipe(ValidateSchema()) _user: UserLike, @Pipe(ValidateSchema()) _name: string): void {}
    static createStatic(@Pipe(ValidateSchema()) _user: CreateUserDto): void {}
}

const parameterFor = (propertyKey: string, value: unknown, parameterIndex = 0, target: any = Controller): ParameterDefinition => {
    const parameter = ParameterDefinition.fromMetadata({ target, propertyKey, parameterIndex, parameter: 'body' });
    parameter.setValue(value);
    return parameter;
};

describe('ValidateSchemaPipeStep', () => {
    const step = new ValidateSchemaPipeStep();

    it('should return the pipe step and options when called as a function', () => {
        const options = { whitelist: true };
        expect(ValidateSchema(options)).toStrictEqual({ pipeStep: ValidateSchemaPipeStep, PipeStepConfig: { options } });
        expect(ValidateSchema()).toStrictEqual({ pipeStep: ValidateSchemaPipeStep, PipeStepConfig: { options: undefined } });
    });

    it('should return an instance of the inferred class when validation succeeds', async () => {
        const result = await step.execute(parameterFor('create', { email: 'user@axispark.dev', age: 30 }));

        expect(result).toBeInstanceOf(CreateUserDto);
        expect(result).toEqual(expect.objectContaining({ email: 'user@axispark.dev', age: 30 }));
    });

    it('should validate values that are already instances of the inferred class', async () => {
        const user = Object.assign(new CreateUserDto(), { email: 'user@axispark.dev', age: 30 });

        await expect(step.execute(parameterFor('create', user))).resolves.toBe(user);
    });

    it('should infer the class of static method parameters', async () => {
        await expect(step.execute(parameterFor('createStatic', { email: 'wrong', age: 30 }))).rejects.toThrow(PipeStepValidationError);
    });

    it('should throw a validation error with the failing constraints', async () => {
        const promise = step.execute(parameterFor('create', { email: 'wrong', age: 3 }));

        await expect(promise).rejects.toThrow(PipeStepValidationError);
        await expect(promise).rejects.toThrow(/email: email must be an email.*age: age must not be less than 18/);
    });

    it('should include nested property paths in the error message', async () => {
        const address = Object.assign(new AddressDto(), { city: 42 });

        await expect(step.execute(parameterFor('create', { email: 'user@axispark.dev', age: 30, address }))).rejects.toThrow(
            /address\.city: city must be a string/
        );
    });

    it.each([[null], ['text'], [42], [[{ email: 'user@axispark.dev' }]]])('should throw a validation error for non-object value %p', async (value) => {
        await expect(step.execute(parameterFor('create', value))).rejects.toThrow(/Value must be an object matching 'CreateUserDto'/);
    });

    it('should pass the options through to class-validator', async () => {
        const value = { email: 'user@axispark.dev', age: 30, extra: true };

        await expect(step.execute(parameterFor('create', value))).resolves.toBeInstanceOf(CreateUserDto);
        await expect(step.execute(parameterFor('create', value), { options: { whitelist: true, forbidNonWhitelisted: true } })).rejects.toThrow(
            /extra: property extra should not exist/
        );

        const whitelisted = await step.execute(parameterFor('create', value), { options: { whitelist: true } });
        expect(whitelisted).not.toHaveProperty('extra');
    });

    it('should apply validation groups from the options', async () => {
        const value = { email: 'user@axispark.dev', age: 30.5 };

        await expect(step.execute(parameterFor('create', value), { options: { groups: ['admin'] } })).rejects.toThrow(/age must be an integer number/);
        await expect(step.execute(parameterFor('create', value), { options: { groups: ['public'], forbidUnknownValues: false } })).resolves.toBeInstanceOf(
            CreateUserDto
        );
    });

    it('should report errors that are not bound to a property without a path', async () => {
        await expect(step.execute(parameterFor('create', {}), { options: { groups: ['public'] } })).rejects.toThrow(
            "Validation failed for 'body': an unknown value was passed to the validate function"
        );
    });

    it.each([
        ['an interface', 0],
        ['a primitive', 1]
    ])('should throw a clear error when the parameter type is %s', async (_, parameterIndex) => {
        const promise = step.execute(parameterFor('untyped', {}, parameterIndex));

        await expect(promise).rejects.toThrow(PipeStepError);
        await expect(promise).rejects.not.toThrow(PipeStepValidationError);
        await expect(promise).rejects.toThrow(/requires a class-typed parameter/);
    });

    it('should throw a clear error when there is no type metadata', async () => {
        class WithoutMetadata {
            handle(): void {}
        }

        await expect(step.execute(parameterFor('handle', {}, 0, WithoutMetadata))).rejects.toThrow(
            /Schema validation for 'body' in WithoutMetadata.handle requires a class-typed parameter/
        );
    });
});
