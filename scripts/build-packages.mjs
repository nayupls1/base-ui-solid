// Builds the publishable npm packages into `packages/<name>/dist`.
//
// The workspace manifests point `exports` at the TypeScript sources, which is what the docs and
// the tests consume. Each `dist` gets compiled JS, type declarations and its own `package.json`
// with `exports` rewritten to the compiled files, so it is published as-is:
//
//   bun run build [--version 1.2.3]
//   npm publish packages/utils/dist && npm publish packages/solid/dist
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { build } from 'vite';
import solid from '@solidjs/vite-plugin';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// In dependency order: `solid` pins the `utils` version it was built with.
const packageDirs = ['packages/utils', 'packages/solid'].map((dir) => path.join(root, dir));

const { values: args } = parseArgs({ options: { version: { type: 'string' } } });
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
if (args.version !== undefined && !SEMVER.test(args.version)) {
  throw new Error(`--version must be a semver version, got "${args.version}"`);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const manifests = new Map(packageDirs.map((dir) => [dir, readJson(path.join(dir, 'package.json'))]));
const versions = new Map(
  [...manifests.values()].map((manifest) => [manifest.name, args.version ?? manifest.version]),
);
const repoUrl = manifests.get(packageDirs.at(-1)).repository.url.replace(/^git\+|\.git$/g, '');

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(file);
    }
    return /\.tsx?$/.test(file) && !/\.(test|d)\.tsx?$/.test(file) ? [file] : [];
  });
}

/** `./src/foo/index.ts` -> the compiled file and its declaration. */
function distExport(target) {
  const base = target.replace(/^\.\/src\//, './').replace(/\.tsx?$/, '');
  return { types: `${base}.d.ts`, default: `${base}.js` };
}

/** Workspace ranges mean "the version released together with this one". */
function resolveWorkspaceRanges(dependencies = {}) {
  return Object.fromEntries(
    Object.entries(dependencies).map(([name, range]) => [
      name,
      range.startsWith('workspace:') ? versions.get(name) : range,
    ]),
  );
}

/** npm renders the README outside the repo, so relative links have to become absolute. */
function absolutizeLinks(markdown) {
  return markdown
    .replace(/(<img[^>]*\ssrc=")(?!https?:)([^"]+)/g, `$1${repoUrl}/raw/HEAD/$2`)
    .replace(/(\]\()(?!https?:|#)([^)]+)/g, `$1${repoUrl}/blob/HEAD/$2`);
}

for (const dir of packageDirs) {
  const manifest = manifests.get(dir);
  const src = path.join(dir, 'src');
  const dist = path.join(dir, 'dist');
  fs.rmSync(dist, { recursive: true, force: true });

  // Every source file is compiled on its own: nothing is bundled, so the output mirrors `src`
  // and `export * as X` stays a native namespace re-export that consumers can tree-shake.
  await build({
    root: dir,
    configFile: false,
    logLevel: 'warn',
    plugins: [
      solid(),
      {
        name: 'externalize-imports',
        enforce: 'pre',
        async resolveId(source, importer) {
          if (!importer) {
            return null;
          }
          if (!source.startsWith('.')) {
            return { id: source, external: true };
          }
          const resolved = await this.resolve(source, importer, { skipSelf: true });
          if (!resolved) {
            throw new Error(`Cannot resolve "${source}" from ${importer}`);
          }
          return { id: resolved.id.replace(/\.tsx?$/, '.js'), external: 'relative' };
        },
      },
    ],
    build: {
      outDir: dist,
      target: 'esnext',
      minify: false,
      lib: {
        entry: Object.fromEntries(
          sourceFiles(src).map((file) => [path.relative(src, file).replace(/\.tsx?$/, ''), file]),
        ),
        formats: ['es'],
      },
      rollupOptions: { output: { entryFileNames: '[name].js' } },
    },
  });

  execFileSync(
    path.join(root, 'node_modules/.bin/tsc'),
    ['-p', path.join(dir, 'tsconfig.build.json'), '--outDir', dist],
    { stdio: 'inherit' },
  );

  const { devDependencies, ...published } = manifest;
  fs.writeFileSync(
    path.join(dist, 'package.json'),
    `${JSON.stringify(
      {
        ...published,
        version: versions.get(manifest.name),
        exports: {
          ...Object.fromEntries(
            Object.entries(manifest.exports).map(([key, target]) => [key, distExport(target)]),
          ),
          './package.json': './package.json',
        },
        dependencies: resolveWorkspaceRanges(manifest.dependencies),
      },
      null,
      2,
    )}\n`,
  );

  const ownReadme = path.join(dir, 'README.md');
  const readme = fs.readFileSync(fs.existsSync(ownReadme) ? ownReadme : path.join(root, 'README.md'), 'utf8');
  fs.writeFileSync(path.join(dist, 'README.md'), absolutizeLinks(readme));
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(dist, 'LICENSE'));

  console.log(`built ${manifest.name}@${versions.get(manifest.name)} -> ${path.relative(root, dist)}`);
}
