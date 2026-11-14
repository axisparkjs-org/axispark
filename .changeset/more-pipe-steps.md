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

New built-in pipe-steps in `@axisparkjs/engine`. `Default(value, { emptyString? })` gives a value to a missing parameter (objects and arrays are copied for each execution), and `Optional({ emptyString? })` skips the rest of the steps of a missing parameter so the handler receives `undefined`: a missing optional parameter no longer answers `400`. `ParseUuid(version?)` checks the UUID format (RFC 9562, versions 1 to 8) and returns it in lower case. `ParseEnum(enumOrValues, { ignoreCase? })` accepts a string or numeric TypeScript enum or an array of values and lists the allowed values in the error. `ParseDate({ dateOnly? })` converts an ISO 8601 date, or a date-time with `Z` or an offset, to a `Date`, and rejects invalid dates such as `2026-02-30` and date-times without an offset. `ParseArray({ separator?, items?, minItems?, maxItems?, unique? })` returns an array from a comma-separated string, a single value or an array, and applies the `items` step (such as `ParseInt()`) to each item. A pipe step can return the new `PipeStepSkip` value to stop the pipe of its parameter, and `PipeStep.execute()` receives the execution context as an optional third argument. The `validating-schemas` sample uses the new steps.
