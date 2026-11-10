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

```tsx
import { Popover } from '@base-ui-solid/solid/popover';

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
bun run build:docs
```

## Layout

- `packages/solid` — the components
- `packages/utils` — shared utilities (store, hooks)
- `docs` — the documentation site (Vite + Solid + MDX)
- `scripts` — the conversion helpers used during the port

## License

[MIT](LICENSE). Base UI is © Material-UI SAS, also under the MIT license. The docs use system
fonts in place of upstream's licensed typefaces.
