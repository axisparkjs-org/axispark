# `@axisparkjs/di`

Dependency injection container of AxiSpark.js.

The complete guide is in the [Dependency Injection documentation](https://axisparkjs.com/docs/getting-started/dependency-injection).

## What the package does

- Marks classes as injectable with `@Injectable()` and resolves their constructor dependencies automatically.
- Supports injection tokens (`InjectionToken`, `@Inject()`, `@InjectableToken()`) for values and interfaces.
- Binds providers by class, value or factory, with singleton, transient and scoped lifetimes.
- Exposes the `Injector` to resolve dependencies at runtime.

## Install and use

```bash
npm install @axisparkjs/di
```

Classes discovered by the application are resolved by the container, so their dependencies are injected in the constructor:

```ts
import { Inject, Injectable, InjectionToken } from '@axisparkjs/di';

export const GREETING = new InjectionToken('GREETING');

@Injectable()
export class GreetingService {
    constructor(@Inject(GREETING) private readonly greeting: string) {}

    public greet(name: string): string {
        return `${this.greeting}, ${name}!`;
    }
}

@Injectable()
export class WelcomeService {
    constructor(private readonly greetingService: GreetingService) {}

    public welcome(): string {
        return this.greetingService.greet('AxiSpark');
    }
}
```
