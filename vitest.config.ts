import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';

export default defineConfig({
  plugins: [solid({ dev: true })],
  resolve: { conditions: ['development', 'browser'] },
  test: {
    environment: 'jsdom',
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'packages/*/test/**/*.test.{ts,tsx}'],
    setupFiles: ['./packages/solid/test/setup.ts'],
    server: { deps: { inline: [/solid-js/, /@solidjs/] } },
  },
});
