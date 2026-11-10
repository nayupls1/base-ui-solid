# Porting status

Port of [mui/base-ui](https://github.com/mui/base-ui) at
`86b31e5875ac4439a400c19d6a12f4b14d69cfd2` to Solid 2.0 (rc.21). See `PORTING.md` for the
conventions used.

## Coverage

Every component exported from upstream's `packages/react/src/index.ts` is ported, plus
`unstable-use-media-query`:

Accordion, Alert Dialog, Autocomplete, Avatar, Button, Checkbox, Checkbox Group, Collapsible,
Combobox, Context Menu, CSP Provider, Dialog, Direction Provider, Drawer, Field, Fieldset, Form,
Input, Menu (including filtering), Menubar, mergeProps, Meter, Navigation Menu, Number Field,
OTP Field, Popover, Preview Card, Progress, Radio, Radio Group, Scroll Area, Select, Separator,
Slider, Switch, Tabs, Toast, Toggle, Toggle Group, Toolbar, Tooltip, useRender.

The docs site (`docs/`) has every component page with its demos (CSS Modules and Tailwind
variants), API reference tables and quick nav.

## Verification

- `bun run test` runs 75 tests in 27 files (jsdom). They cover rendering, ARIA wiring and the
  main interactions of each component family. They're smoke tests, not a port of upstream's
  test suite.
- Each docs page was loaded in headless Chromium (`scripts/docs-check.mjs`) with no errors, and the
  interactive components were exercised headlessly: open/close, focus trapping and return, typing
  and filtering, keyboard navigation, swipe gestures (Toast, Drawer), snap points, nested
  drawers and menus.

## Known gaps and differences

- **Types:** `tsc` still reports about 100 errors. They're mostly store-generic assignability
  (each popup store subclass is structurally different from the shared `PopupRootStore`
  constraint), plus some loose prop typings. They don't affect runtime; the tests and the docs build
  (`bun run build:docs`) compile without type checking.
- **SSR/hydration:** not supported or tested. Upstream's pre-hydration scripts
  (`renderBeforeHydration`, `thumbAlignment="edge"` SSR behavior) are ported as client-only code.
- **Toolchain:** needs `@solidjs/vite-plugin` ≥ 3.0.0-next.57. Older plugin builds compile
  delegated events with a key the rc.21 runtime doesn't read (plain `onClick` never fires).
- **Solid dev warnings:** Solid's dev build reports `EFFECT_WRITES_OWN_SOURCE` /
  `EFFECT_RELAY_TEAR` advisories for effects that sync state the way upstream's layout effects
  do. They're performance hints, not errors, and don't appear in production builds.
- **API differences forced by Solid** (`PORTING.md` covers the general conventions):
  - Reactive values in contexts, hook results and render-prop state are getters/accessors
    (e.g. `Toast.useToastManager().toasts` is a getter, `Combobox.useFilteredItems()` returns an
    accessor).
  - `class` instead of `className`; text inputs use `onInput`.
  - Toast lists should be keyed by id: `<For each={toasts} keyed={(t) => t.id}>`.
  - `Combobox.Value` renders a function child once in multiple mode, with a live view of the
    selected array, so the input inside it keeps focus.
  - Payload render functions (`{({ payload }) => …}`) re-run when the payload changes, and the
    filterable menu's state lives inside that render function, so switching a detached trigger's
    payload resets an uncontrolled filter.
- **Docs:** system font stacks replace upstream's licensed typefaces, and the site uses its own
  icon instead of the Base UI logo. The virtualized demos use a small `@tanstack/virtual-core` binding (`docs/src/utils/
createVirtualizer.ts`) because `@tanstack/solid-virtual` targets Solid 1.
