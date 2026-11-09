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
"@axisparkjs/schedule": minor
"@axisparkjs/security": minor
"@axisparkjs/test": minor
"@axisparkjs/websocket": minor
"@axisparkjs/websocket-socketio": minor
---

**Scanner include and exclude.** New `scanner` option in `AxiSparkConfig` with `include` and `exclude` glob patterns to choose the files that `FileSystemScanner` loads from `basePath`. The `exclude` patterns are added to the default exclusions, which now also ignore every bootstrap file (`*.bootstrap.{js,ts}`, not only `index.bootstrap`), the `*.test.{js,ts}` files and the `coverage` folder. The scanner logs the number of loaded files at `debug` level and each file at `trace` level. Applications that relied on the scanner importing bootstrap files other than `index.bootstrap` must import them explicitly.
