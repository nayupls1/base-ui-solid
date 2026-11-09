import fs from 'node:fs/promises';
import path from 'node:path';
import { highlightToFramesHtml } from './highlight.mjs';

const IMPORT_RE = /^\s*import\s+(?:[^'"]*?from\s+)?['"](\.{1,2}\/[^'"]+)['"]/gm;

async function resolveLocal(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')];
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) {
        return candidate;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

/**
 * Collapsed demos show the JSX the default export returns, like upstream.
 */
function findFocusStart(code, language) {
  if (!/^(tsx|jsx)$/.test(language)) {
    return 0;
  }
  const lines = code.split('\n');
  const exportIndex = lines.findIndex((line) => line.startsWith('export default function'));
  if (exportIndex === -1) {
    return 0;
  }
  const returnIndex = lines.findIndex((line, index) => index > exportIndex && /^  return \(/.test(line));
  return returnIndex === -1 ? exportIndex : returnIndex;
}

/**
 * Collects a demo entry file and the local files it imports (recursively), returning their
 * source and highlighted HTML. The entry is listed first.
 */
export async function collectDemoFiles(entry) {
  const files = [];
  const seen = new Set();

  async function visit(file) {
    if (seen.has(file)) {
      return;
    }
    seen.add(file);
    const code = await fs.readFile(file, 'utf8');
    const language = path.extname(file).slice(1);
    files.push({
      file,
      name: path.basename(file),
      language,
      code,
      html: await highlightToFramesHtml(code, language, findFocusStart(code, language)),
    });

    if (!/\.(tsx?|jsx?)$/.test(file)) {
      return;
    }

    for (const match of code.matchAll(IMPORT_RE)) {
      const resolved = await resolveLocal(file, match[1]);
      if (resolved) {
        await visit(resolved);
      }
    }
  }

  await visit(entry);
  return files.map(({ file, ...rest }) => rest);
}

/**
 * Vite plugin: `import files from './demo/index.tsx?demo-files'` returns the highlighted source
 * of the demo and its local dependencies.
 */
export function demoSourcesPlugin() {
  return {
    name: 'base-ui-solid-demo-sources',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!source.endsWith('?demo-files') || !importer) {
        return null;
      }
      const specifier = source.slice(0, -'?demo-files'.length);
      const resolved = await resolveLocal(importer, specifier);
      return resolved ? `${resolved}?demo-files` : null;
    },
    async load(id) {
      if (!id.endsWith('?demo-files')) {
        return null;
      }
      const file = id.slice(0, -'?demo-files'.length);
      const files = await collectDemoFiles(file);
      for (const entry of files) {
        this.addWatchFile(file);
      }
      return `export default ${JSON.stringify(files)};`;
    },
  };
}
