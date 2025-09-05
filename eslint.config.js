const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const path = require('path');

const compat = new FlatCompat({
  baseDirectory: path.resolve(),
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...compat.extends('expo'), 
  ...compat.extends('prettier'),
  {
    files: ['jest-setup.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        global: 'readonly',
        console: 'readonly',
        require: 'readonly',
        setTimeout: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        createMockViewportState: 'readonly',
        createMockBeacon: 'readonly',
        createMockModuleContext: 'readonly',
      },
    },
    rules: {
      'react/display-name': 'off',
    },
  },
];
