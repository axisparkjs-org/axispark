# `@axisparkjs/ddd`

TypeScript building blocks to express domain concepts following Domain-Driven Design.

The complete guide is in the [Domain-Driven Design documentation](https://axisparkjs.com/docs/category/domain-driven-design).

## What the package does

- Provides `ValueObject` and `Identifier` base classes with validation and value equality.
- Provides `Entity` and `AggregateRoot` base classes with identity equality.
- Lets aggregate roots record `DomainEvent` instances to be dispatched by the application.
- Defines `DomainException` for domain-specific errors.

It does not persist aggregates or publish events: the application decides how to store and dispatch them.

## Install and use

```bash
npm install @axisparkjs/ddd
```

```ts
import { Entity, Identifier, ValueObject } from '@axisparkjs/ddd';

export class CustomerId extends Identifier<string> {
    protected validate(value: string): void {
        if (value.trim().length === 0) throw new Error('Customer ID cannot be empty');
    }
}

export class EmailAddress extends ValueObject<string> {
    protected validate(value: string): void {
        if (!value.includes('@')) throw new Error('Email address must contain @');
    }

    public toString(): string {
        return this.value;
    }
}

export class Customer extends Entity<CustomerId> {
    constructor(
        id: CustomerId,
        public email: EmailAddress
    ) {
        super(id);
    }
}
```
