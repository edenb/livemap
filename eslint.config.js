import js from '@eslint/js';
import globals from 'globals';
import pluginPrettier from 'eslint-plugin-prettier/recommended';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    {
        files: ['**/*.js'],
        plugins: { js },
        extends: ['js/recommended'],
        rules: { 'no-unused-vars': 'off' },
        languageOptions: { globals: { ...globals.node, ...globals.mocha } },
    },
    pluginPrettier, // Prettier always last
]);
