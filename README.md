<img src="assets/icon.svg" width="64" height="64" alt="">

# base-ui-solid

A port of [Base UI](https://github.com/mui/base-ui), the unstyled, accessible component library,
to [Solid 2.0](https://github.com/solidjs/solid). It follows upstream closely: the same
components, parts, props, data attributes and CSS variables, adapted to Solid's reactivity.

> This is an unofficial community port. It isn't affiliated with or endorsed by MUI or the
> Base UI team. "Base UI" refers to the upstream project.

Ported from upstream commit
[`86b31e5`](https://github.com/mui/base-ui/tree/86b31e5875ac4439a400c19d6a12f4b14d69cfd2).

## Status

Every component upstream exports is ported, and the docs site has a page with demos for each.
The port targets Solid 2.0 (rc.21) and is client-only for now. See
[PORTING-STATUS.md](PORTING-STATUS.md) for coverage, verification and known gaps, and
[PORTING.md](PORTING.md) for how React patterns map to Solid.

## Usage

```sh
npm install base-ui-solidjs
```

```tsx
import { Popover } from 'base-ui-solidjs/popover';

<Popover.Root>
  <Popover.Trigger>Open</Popover.Trigger>
  <Popover.Portal>
    <Popover.Positioner sideOffset={8}>
      <Popover.Popup>Hello</Popover.Popup>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>;
```

Compile with `@solidjs/vite-plugin` 3.0.0-next.57 or newer; older versions don't match the
rc.21 runtime.

## Development

```sh
bun install
bun run dev          # docs site
bun run test         # vitest (jsdom)
bun run build        # the npm packages, into packages/*/dist
bun run build:docs
```

## Releasing

Both packages are published together, at the same version, by the
[release workflow](.github/workflows/release.yml). Publish a GitHub release whose tag is the
version, such as `v0.1.0`:

```sh
gh release create v0.1.0 --generate-notes
```

The workflow runs the tests, builds `packages/*/dist` at that version and publishes them to npm
with provenance. A prerelease tag such as `v0.2.0-beta.1` is published under the `next` dist-tag
instead of `latest`. The versions in the repo's `package.json` files stay at `0.0.0`; the tag is
the version.

One-time setup: the workflow authenticates with npm
[trusted publishing](https://docs.npmjs.com/trusted-publishers), which is configured per package
(repository `nayupls1/base-ui-solid`, workflow `release.yml`) and so needs the packages to exist.
For the first release, add an npm access token that may publish new packages as the `NPM_TOKEN`
repository secret; once trusted publishing is set up, delete it.

## Layout

- `packages/solid` — the components
- `packages/utils` — shared utilities (store, hooks)
- `docs` — the documentation site (Vite + Solid + MDX)
- `scripts` — the conversion helpers used during the port

## License

[MIT](LICENSE). Base UI is © Material-UI SAS, also under the MIT license. The docs use system
fonts in place of upstream's licensed typefaces.
