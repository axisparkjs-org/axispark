---
"@axisparkjs/cli": patch
"@axisparkjs/common": patch
"@axisparkjs/core": patch
"@axisparkjs/data": patch
"@axisparkjs/ddd": patch
"@axisparkjs/di": patch
"@axisparkjs/engine": patch
"@axisparkjs/http": patch
"@axisparkjs/http-express": patch
"@axisparkjs/http-fastify": patch
"@axisparkjs/kafka": patch
"@axisparkjs/logger": patch
"@axisparkjs/mcp": patch
"@axisparkjs/openapi": patch
"@axisparkjs/rabbitmq": patch
"@axisparkjs/redis": patch
"@axisparkjs/schedule": patch
"@axisparkjs/security": patch
"@axisparkjs/store": patch
"@axisparkjs/test": patch
"@axisparkjs/websocket": patch
"@axisparkjs/websocket-socketio": patch
---

`HttpResults.Download()` and `HttpResults.Stream()` build the `Content-Disposition` header as described by RFC 6266, with the new `contentDisposition(filename, type)` helper of `@axisparkjs/http`. The header has an ASCII fallback in `filename`, with the characters outside ASCII replaced with `?` and the double quotes escaped, and the name encoded in UTF-8 in `filename*` (RFC 8187) when it is not plain ASCII. A file name with quotes or accents is downloaded with its real name, a file name outside Latin-1 no longer fails with `500`, and the control characters and path separators of the name are removed, so a name taken from user data always produces a valid header.
