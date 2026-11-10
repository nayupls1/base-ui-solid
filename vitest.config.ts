import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';

export default defineConfig({
  // The native (Oxc) JSX compiler in @dom-expressions/compiler 0.50.0-next.40 drops the insertion
  // marker between text siblings (`<p>a <C /> b</p>` renders C last). Babel compiles it correctly.
  plugins: [solid({ dev: true, compiler: 'babel' })],
  resolve: { conditions: ['development', 'browser'] },
  test: {
    environment: 'jsdom',
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'packages/*/test/**/*.test.{ts,tsx}'],
    setupFiles: ['./packages/solid/test/setup.ts'],
    server: { deps: { inline: [/solid-js/, /@solidjs/] } },
  },
});
