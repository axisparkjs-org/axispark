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

New `axispark manifest [dir]` command, which writes the module manifest of a compiled application (`axispark.manifest.json`) with the files that the scanner imports. When the base path has a manifest, `FileSystemScanner` imports its files instead of searching the file system with `fast-glob`, which makes the cold starts faster; without it, the scanner searches the file system as before. New `scanner.manifest` option (another file, or `false`) and `createScannerManifest()`, `writeScannerManifest()` and `readScannerManifest()` in `@axisparkjs/core`. The files found by the scanner are now imported in alphabetical order.
