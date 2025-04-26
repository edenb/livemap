import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default defineConfig([
    {
        files: ['**/*.js'],
        plugins: {
            js,
        },
        extends: ['js/recommended'],
        rules: {
            'no-unused-vars': 'off',
        },
        languageOptions: {
            globals: {
                ...globals.mocha,
                ...globals.node,
            },
        },
    },
    // Prettier config always last
    eslintPluginPrettierRecommended,
]);
