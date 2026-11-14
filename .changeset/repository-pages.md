---
"@axisparkjs/cli": minor
"@axisparkjs/common": minor
"@axisparkjs/core": minor
"@axisparkjs/data": minor
"@axisparkjs/ddd": minor
"@axisparkjs/di": minor
"@axisparkjs/engine": minor
"@axisparkjs/http": minor
"@axisparkjs/http-express": minor
"@axisparkjs/http-fastify": minor
"@axisparkjs/kafka": minor
"@axisparkjs/logger": minor
"@axisparkjs/mcp": minor
"@axisparkjs/openapi": minor
"@axisparkjs/rabbitmq": minor
"@axisparkjs/redis": minor
"@axisparkjs/schedule": minor
"@axisparkjs/security": minor
"@axisparkjs/store": minor
"@axisparkjs/test": minor
"@axisparkjs/websocket": minor
"@axisparkjs/websocket-socketio": minor
---

New repository operations in `@axisparkjs/data`.

**Breaking change:** a derived `findBy` method that receives a `PageRequest` now resolves with a `Page<T>` (`{ content, page, size, totalElements, totalPages }`) instead of `T[]`. The total is counted with the same predicates (`getManyAndCount()` in SQL, `countDocuments()` in MongoDB), so the extra `countBy` query is no longer needed. Read the entities from `page.content`, and declare the methods as `(…, page: PageRequest) => Promise<Page<T>>`. The methods without a `PageRequest` do not change.

- `BaseRepository` has `findById(id)` (resolves with `null` when the entity does not exist), `findByIds(ids)`, `existsById(id)` and `deleteById(id)` (resolves with the number of deleted entities). They use the primary columns of the entity metadata, so they work with any column name and with composite keys (given as objects), and in MongoDB a hexadecimal string is converted to an `ObjectId`. `findPage(options, pageRequest)` returns a `Page` for queries that are not derived.
- New derived query keywords: `Not`, `NotIn`, `Containing`, `StartingWith`, `EndingWith`, the `IgnoreCase` suffix (after a property or after `Not`, `Like`, `Containing`, `StartingWith` and `EndingWith`) and `True` / `False`. The values of `Containing`, `StartingWith` and `EndingWith` are escaped, so `%` and `_` are matched literally. `In` and `NotIn` with an empty array match nothing and everything instead of failing with `IN ()`.
- New `deleteBy…` derived methods, with the same predicates as `findBy`, that resolve with the number of deleted entities and join the active transaction.
