# `@axisparkjs/data`

TypeORM integration for AxiSpark.js. It creates named data sources and generates repositories with derived query methods.

The complete guide is in the [Data Plugin documentation](https://axisparkjs.github.io/axispark/docs/category/data-plugin).

## What the package does

- Creates one or more named TypeORM data sources and closes them when the application stops.
- Discovers classes decorated with `@Repository()` and binds them in the dependency injection container.
- Provides `BaseRepository` with the common CRUD operations of the entity.
- Implements derived queries from method names, such as `findByStatusOrderByAgeDesc` or `countByStatus`, for SQL databases and MongoDB.

## Install and register

Install the package and the driver of your database (`pg`, `mysql2`, `mongodb`...):

```bash
npm install @axisparkjs/data typeorm pg
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { DataPlugin, DataPluginOptionsFactory } from '@axisparkjs/data';
import { Customer } from './customer';

const app = AxiSparkFactory.create({ name: 'Example', basePath: __dirname });

app.use(
    DataPlugin,
    DataPluginOptionsFactory.create({
        dataSources: [
            {
                name: 'PRIMARY',
                options: { type: 'postgres', host: 'localhost', port: 5432, username: 'axispark', password: 'axispark', database: 'axispark', entities: [Customer] }
            }
        ]
    })
);
```

Declare a repository for a TypeORM entity. It can be injected in any injectable class:

```ts title="customer.repository.ts"
import { BaseRepository, Repository } from '@axisparkjs/data';
import { Customer } from './customer';

@Repository({ entity: Customer })
export class CustomerRepository extends BaseRepository<Customer> {
    declare findOneByEmail: (email: string) => Promise<Customer | null>;

    declare countByStatus: (status: string) => Promise<number>;
}
```
