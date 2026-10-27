const config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleDirectories: ['node_modules'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {}]
    },
    collectCoverage: true,
    coverageThreshold: {
        global: {
            branches: 95,
            functions: 95,
            lines: 95,
            statements: 95
        }
    },
    cache: false,
    detectOpenHandles: true,
    coveragePathIgnorePatterns: ['/node_modules/', '/lib/', '/index.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/lib/'],
    passWithNoTests: true,
    moduleNameMapper: {
        '^@axisparkjs/common$': '<rootDir>../../packages/common/src',
        '^@axisparkjs/common/(.*)$': '<rootDir>../../packages/common/src/$1',
        '^@axisparkjs/core$': '<rootDir>../../packages/core/src',
        '^@axisparkjs/core/(.*)$': '<rootDir>../../packages/core/src/$1',
        '^@axisparkjs/data$': '<rootDir>../../packages/data/src',
        '^@axisparkjs/data/(.*)$': '<rootDir>../../packages/data/src/$1',
        '^@axisparkjs/ddd$': '<rootDir>../../packages/ddd/src',
        '^@axisparkjs/ddd/(.*)$': '<rootDir>../../packages/ddd/src/$1',
        '^@axisparkjs/di$': '<rootDir>../../packages/di/src',
        '^@axisparkjs/di/(.*)$': '<rootDir>../../packages/di/src/$1',
        '^@axisparkjs/engine$': '<rootDir>../../packages/engine/src',
        '^@axisparkjs/engine/(.*)$': '<rootDir>../../packages/engine/src/$1',
        '^@axisparkjs/http$': '<rootDir>../../packages/http/src',
        '^@axisparkjs/http/(.*)$': '<rootDir>../../packages/http/src/$1',
        '^@axisparkjs/http-express$': '<rootDir>../../packages/http-express/src',
        '^@axisparkjs/http-express/(.*)$': '<rootDir>../../packages/http-express/src/$1',
        '^@axisparkjs/http-fastify$': '<rootDir>../../packages/http-fastify/src',
        '^@axisparkjs/http-fastify/(.*)$': '<rootDir>../../packages/http-fastify/src/$1',
        '^@axisparkjs/kafka$': '<rootDir>../../packages/kafka/src',
        '^@axisparkjs/kafka/(.*)$': '<rootDir>../../packages/kafka/src/$1',
        '^@axisparkjs/security$': '<rootDir>../../packages/security/src',
        '^@axisparkjs/security/(.*)$': '<rootDir>../../packages/security/src/$1',
        '^@axisparkjs/logger$': '<rootDir>../../packages/logger/src',
        '^@axisparkjs/logger/(.*)$': '<rootDir>../../packages/logger/src/$1',
        '^@axisparkjs/openapi$': '<rootDir>../../packages/openapi/src',
        '^@axisparkjs/openapi/(.*)$': '<rootDir>../../packages/openapi/src/$1',
        '^@axisparkjs/rabbitmq$': '<rootDir>../../packages/rabbitmq/src',
        '^@axisparkjs/rabbitmq/(.*)$': '<rootDir>../../packages/rabbitmq/src/$1',
        '^@axisparkjs/schedule$': '<rootDir>../../packages/schedule/src',
        '^@axisparkjs/schedule/(.*)$': '<rootDir>../../packages/schedule/src/$1',
        '^@axisparkjs/test$': '<rootDir>../../packages/test/src',
        '^@axisparkjs/test/(.*)$': '<rootDir>../../packages/test/src/$1',
        '^@axisparkjs/websocket$': '<rootDir>../../packages/websocket/src',
        '^@axisparkjs/websocket/(.*)$': '<rootDir>../../packages/websocket/src/$1',
        '^@axisparkjs/websocket-socketio$': '<rootDir>../../packages/websocket-socketio/src',
        '^@axisparkjs/websocket-socketio/(.*)$': '<rootDir>../../packages/websocket-socketio/src/$1'
    },
    setupFiles: ['<rootDir>/jest.setup.ts']
};

module.exports = config;
