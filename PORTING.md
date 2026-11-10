# Porting notes: Base UI (React) → Solid 2.0

Upstream: https://github.com/mui/base-ui, snapshot `86b31e5875ac4439a400c19d6a12f4b14d69cfd2` (v1.9.0).
A shallow clone lives at `/tmp/upstream/base-ui` while porting (re-clone if missing).

The goal is a 1:1 port: same parts, prop names, data attributes, CSS variables, ARIA
behaviour and keyboard interactions. Differences only where React and Solid fundamentally
differ. They're listed here and in `docs/src/content/handbook-solid.md`.

## Public API differences

| React (upstream)                                    | Solid (this port)                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `className` (string or `(state) => string`)          | `class` (string/Solid class value or `(state) => string`)                           |
| `style` (camelCase object or `(state) => object`)    | `style` (Solid kebab-case object/string, or `(state) => object`)                    |
| `render={<a />}`                                     | `render={<a />}` works too: the element is created once and props are spread onto it |
| `render={(props, state) => <a {...props} />}`        | same; `props` and `state` are reactive objects, so spread them, don't destructure   |
| —                                                    | `render="a"`: a tag name shorthand                                                  |
| `ref` objects                                        | callback refs (`ref={el => …}` or `let el; ref={el}`)                              |
| React synthetic events                               | native events; `event.preventBaseUIHandler()` is still available                    |
| `onChange` of text inputs                            | `onInput` (native), `onValueChange` unchanged                                        |
| `onFocus`/`onBlur` bubbling                          | native semantics; use `onFocusIn`/`onFocusOut` for bubbling                          |
| `actionsRef`                                         | `actionsRef` accepts `{ current }` objects or a callback receiving the actions      |
| Hooks returning values                               | primitives returning accessors (`() => T`)                                          |

## Internal conventions

- Components run once. Anything derived from props is read inside JSX, a memo, or a getter.
  Never destructure props.
- `useRenderElement(tag, componentProps, params)` (src/internals/useRenderElement.tsx) is the
  heart of every part. `params.state` is an accessor; `params.props` is an array of prop
  objects. Objects may use getters for reactive values; function entries `(merged) => props`
  run inside the memo like upstream's mergeProps function entries.
- Reactive prop objects use getters: `{ get 'aria-expanded'() { return open(); }, onClick }`.
- `aria-*` booleans are stringified centrally in `useRenderElement` (Solid 2 drops
  `aria-x={false}` otherwise).
- Internal style objects use kebab-case keys (`'transition-duration'`).
- Attribute names are lowercase (`tabindex`, `for`, `readonly`, `autocomplete`...).
- Internal signals that may be written from computations use `{ ownedWrite: true }`, or
  `createSyncSignal` from `@base-ui-solid/utils/createSyncSignal` when imperative code must read
  the new value right after writing it (upstream relies on that a lot).
- `ReactiveStore` (`@base-ui-solid/utils/store`) replaces upstream's `ReactStore`. `store.state`
  is synchronous; `store.useState(selector)` returns a memo accessor; `store.read(selector)` is
  a tracked read for use in getters.
- Upstream `useIsoLayoutEffect(fn, deps)` → `createEffect(() => deps, fn)` (or
  `createRenderEffect` when it must run before paint). Upstream `useEffect` → `createEffect`.
- Context: `createContext<T | null>(null)` + `useXContext(optional)` helpers that throw the
  upstream error message, matching upstream behaviour.
- Floating UI: upstream's internal floating-ui-react fork (`utils/popups/**`) is ported on top
  of `@floating-ui/dom`.

## Solid 2 gotchas (verified with probes)

- **Effect callbacks must return `undefined` or a cleanup function.** Anything else throws and
  halts the whole reactive system (`REACTIVITY_HALTED`). Always use block bodies in effect
  callbacks: `createEffect(() => x(), (v) => { doThing(v); })`.
- `createEffect` apply runs after the DOM is attached (like `useLayoutEffect`);
  `createRenderEffect` runs synchronously at creation, before refs.
- Refs run before the element is attached. Writing signals inside refs is fine.
- Writing a signal in a component body/memo throws unless `{ ownedWrite: true }`.
- `aria-x={false}` removes the attribute. `useRenderElement` stringifies aria booleans.
- `createContext(undefined)`/`value={undefined}` means "no provider" and throws: use `null`.

## Status

See the checklist in `PORTING-STATUS.md`.

## More conventions

- In `params.props` arrays, function entries *replace* the accumulated props (upstream
  semantics). Use plain objects with getters for reactive values, and functions only for
  `(merged) => mergeProps(merged, …)`-style wrappers such as `getButtonProps`.
- When an element must be created inside a context provider rendered by the same component,
  create it lazily inside the provider: `<Ctx value={v}>{untrack(() => useRenderElement(…))}</Ctx>`.
  Children getters are evaluated where they're accessed, so the provider must be an ancestor
  in the owner tree at that point.
- Hook parameters are objects with getters (`useButton({ get disabled() { … } })`). Hooks never
  destructure them; they read `params.x` lazily.
- **Never read component props inside effect callbacks without `ownedProps`.** Solid compiles
  conditional JSX props (`x={a ? b : c}`) into getters that create a memo when read, which throws
  `PRIMITIVE_IN_EFFECT_CALLBACK` in an effect callback. Every component starts with
  `props = ownedProps(props)` (`scripts/apply-owned-props.py` inserts it), which re-parents such
  reads to the component owner.
- Solid's event delegation bubbles through portals via `_$host`. Upstream's "inside React tree"
  capture-phase marking is replaced by `isInsideLogicalTree()` (utils/popups/element.ts).
- `@floating-ui/react-dom`'s `useFloating` is ported as `usePosition`
  (utils/popups/positioning/usePosition.ts); middleware wrappers that fold `deps` into options
  live in positioning/middleware.ts.
- **Use `compiler: 'babel'` in `@solidjs/vite-plugin`.** The native Oxc JSX compiler
  (`@dom-expressions/compiler` 0.50.0-next.40) drops the insertion marker between text siblings, so
  `<p>a <C /> b</p>` renders `C` after `b`. Babel (`babel-preset-solid`) compiles it correctly.
  Consumers of this library must do the same until that's fixed upstream.
- `<For>` children receive plain items (keyed), not accessors.
- Payload render functions (`{({ payload }) => …}`) re-run when the payload changes; the previous
  subtree is disposed first (see `renderPayloadChildren` in utils/popups/popupRoot.tsx). Demos that
  passed JSX elements as payloads pass render functions instead (a JSX element is a single DOM node).
