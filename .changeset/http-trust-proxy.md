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

**Trusted proxies.** New `trustProxy` option in `HttpPluginOptions` to resolve the client address from the `X-Forwarded-For` header when the application runs behind a reverse proxy or a load balancer. It accepts `true`, the number of trusted proxies, or the addresses and subnets of the trusted proxies, and is passed to Express (`trust proxy` setting) and Fastify (`trustProxy` server option). It defaults to `false`, so `request.ip` and the rate limits keep using the socket address unless it is set.
