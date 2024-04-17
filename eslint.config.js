import js from '@eslint/js';
import globals from 'globals';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
    js.configs.recommended,
    {
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
    eslintPluginPrettierRecommended, // Prettier config always last
];
