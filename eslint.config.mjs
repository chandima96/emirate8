import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  ...nextVitals,
  prettier,
  {
    rules: {
      // Listing media can be browser-generated data URLs, so plain <img> is intentional.
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'node_modules/**', 'src/data/dubai-map.js']),
]);
