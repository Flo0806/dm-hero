// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  files: ['**/*.ts', '**/*.tsx', '**/*.vue', '**/*.js', '**/*.mjs'],
  rules: {
    // Vue-specific rules
    'vue/multi-word-component-names': 'off', // Allow single-word component names
    'vue/max-attributes-per-line': 'off', // Prettier handles this
    'vue/html-indent': 'off', // Prettier handles this
    'vue/html-closing-bracket-newline': 'off', // Prettier handles this
    'vue/singleline-html-element-content-newline': 'off', // Allow inline content
    'vue/multiline-html-element-content-newline': 'off', // Prettier handles this
    'vue/first-attribute-linebreak': 'off', // Prettier handles this
    'vue/html-self-closing': [
      'error',
      {
        html: {
          void: 'always', // Allow <input /> <br /> etc.
          normal: 'always', // Allow <div /> when no content
          component: 'always', // Always self-close components
        },
        svg: 'always',
        math: 'always',
      },
    ],

    // TypeScript rules
    '@typescript-eslint/no-explicit-any': 'error', // Enforce no implicit any
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],

    // General rules
    quotes: ['error', 'single', { avoidEscape: true }], // Single quotes
    semi: ['error', 'never'], // No semicolons
    'comma-dangle': ['error', 'always-multiline'], // Trailing commas
    indent: ['error', 2], // 2 spaces indentation
    'no-console': 'off', // Allow console (useful for debugging)
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
  },
})
