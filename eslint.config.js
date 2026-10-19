import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'public/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // La simulación no puede usar azar no determinista.
      // `Math.random()` y `Date.now()` dentro del bucle rompen la seed.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Prohibido Math.random() en la simulación. Usá el PRNG con semilla (src/core/prng.js).',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Prohibido Date.now() en la simulación. Usá el tiempo del timestep fijo.',
        },
      ],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'off',
      'no-debugger': 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['scripts/**/*'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
