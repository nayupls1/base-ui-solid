import path from 'node:path';
import { defineConfig } from 'vite';
import solid from '@solidjs/vite-plugin';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';
import { rehypeHighlightCode } from './plugins/markdown.mjs';
import { rehypeQuickNav, remarkQuickNavExcludeHeading } from './plugins/quickNav.mjs';
import { demoSourcesPlugin } from './plugins/demoSources.mjs';
import { typesPlugin } from './plugins/types.mjs';

export default defineConfig({
  resolve: {
    alias: {
      'docs/src': path.resolve(__dirname, 'src'),
    },
    conditions: ['development', 'browser'],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
  plugins: [
    demoSourcesPlugin(),
    typesPlugin(),
    {
      enforce: 'pre',
      ...mdx({
        jsx: true,
        mdExtensions: [],
        elementAttributeNameCase: 'html',
        stylePropertyNameCase: 'css',
        mdxExtensions: ['.mdx'],
        remarkPlugins: [remarkGfm, remarkQuickNavExcludeHeading],
        rehypePlugins: [rehypeQuickNav, rehypeHighlightCode],
      }),
    },
    // See vitest.config.ts: the native JSX compiler misplaces components between text nodes.
    solid({ extensions: ['.mdx'], compiler: 'babel' }),
  ],
  server: {
    port: 3005,
  },
});
