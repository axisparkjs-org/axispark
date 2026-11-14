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

New application settings in `@axisparkjs/core`: the `settings` option of `AxiSparkFactory.create()` reads the environment variables and the `.env` files (`envFiles`, parsed with `util.parseEnv()` of Node.js, without new dependencies), converts them with the `EnvReader` given to `load` (`string`, `int`, `float`, `boolean`, `enum`, `url`, `json` and `list`) and validates them when the application is created. A variable without a default is required, and an invalid configuration throws one `InvalidSettingsError` that lists every problem, without printing the values of the rules that can involve secrets. The real environment variables win over the files, and the earlier files win over the later ones. The settings object is deeply frozen, typed from the return type of `load` in `app.settings` (available before `init()` to build the plugin options), and injected with the new `@EnvSettings()` decorator or the `AXISPARK_ENV_SETTINGS` token. `AxiSparkTestFactory.create({ settings })` of `@axisparkjs/test` replaces the settings without reading the environment, and reuses the settings already loaded by `app` when it is not given. The `caching-responses`, `shared-stores` and `sessions-and-cookies` samples read their port, Redis URL and secrets from the settings, and the templates of `axispark create` include a `.env.example`. Without the `settings` option, nothing changes.
