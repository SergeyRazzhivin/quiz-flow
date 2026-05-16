// @ts-nocheck
import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Disable typo detection for numeric-prefixed FSD layer names (1-app … 6-shared).
    // This project intentionally uses numeric prefixes for layer ordering clarity.
    rules: {
      'fsd/typo-in-layer-name': 'off',
    },
  },
])
