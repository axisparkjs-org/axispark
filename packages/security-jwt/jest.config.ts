import baseConfig from '../../jest.config.js';

export const config = {
    ...baseConfig,
    collectCoverageFrom: ['src/**/*.{ts,js}'],
    setupFiles: ['<rootDir>../../jest.setup.ts']
};
export default config;
