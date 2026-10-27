# `@axisparkjs/common`

Shared types and metadata utilities used by every AxiSpark.js package.

Most applications do not use this package directly: it is installed as a dependency of the other packages. Use it when you build your own plugins, decorators or adapters.

The complete reference is in the [API documentation](https://axisparkjs.github.io/axispark/api/@axisparkjs/common/).

## What the package does

- Exposes common types such as `ClassType`, `MethodType`, `Factory`, `Lifecycle`, `Initializable`, `Runnable`, `Destroyable` and `HttpServer`.
- Provides the `Metadata` helper, a thin wrapper over the Reflect Metadata API that defines and reads metadata on classes, methods, properties and parameters.
- Declares the `MetadataKeys` used by the framework decorators.

## Install and use

```bash
npm install @axisparkjs/common
```

Store and read your own metadata from a custom decorator:

```ts
import { ClassType, Metadata, MetadataKey } from '@axisparkjs/common';

const AUDITED = new MetadataKey('example:audited');

export function Audited(): ClassDecorator {
    return (target) => Metadata.define(AUDITED, true, target);
}

export function isAudited(target: ClassType): boolean {
    return Metadata.get<boolean>(AUDITED, target) ?? false;
}
```
