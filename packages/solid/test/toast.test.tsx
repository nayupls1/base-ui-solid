import { flush, For } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, afterEach } from 'vitest';
import { Toast } from '../src/toast';

const { createToastManager } = Toast;

function mount(fn: () => any) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = render(fn, container);
  disposers.push(dispose);
  return { container, dispose };
}
const disposers: Array<() => void> = [];
function disposeAll() {
  disposers.splice(0).forEach((dispose) => dispose());
}
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

function List() {
  const manager = Toast.useToastManager();
  return (
    <For each={manager.toasts} keyed={(toast) => toast.id}>
      {(toast) => (
        <Toast.Root toast={toast()} data-testid="root">
          <Toast.Content>
            <Toast.Title />
            <Toast.Description />
            <Toast.Action />
            <Toast.Close>x</Toast.Close>
          </Toast.Content>
        </Toast.Root>
      )}
    </For>
  );
}

function Adder(props: { onAdd?: (manager: ReturnType<typeof Toast.useToastManager>) => void }) {
  const manager = Toast.useToastManager();
  return (
    <button
      type="button"
      data-testid="add"
      onClick={() => {
        if (props.onAdd) {
          props.onAdd(manager);
        } else {
          manager.add({ title: 'Hello', description: 'World' });
        }
      }}
    >
      add
    </button>
  );
}

describe('Toast', () => {
  afterEach(() => {
    disposeAll();
    document.body.innerHTML = '';
  });

  it('adds, labels and closes toasts', async () => {
    mount(() => (
      <Toast.Provider>
        <Adder />
        <Toast.Portal>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
        </Toast.Portal>
      </Toast.Provider>
    ));
    const viewport = document.querySelector('[role=region]') as HTMLElement;
    expect(viewport).toHaveAttribute('aria-label', 'Notifications');
    (document.querySelector('[data-testid=add]') as HTMLElement).click();
    flush();
    await tick();
    flush();
    const root = document.querySelector('[data-testid=root]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute('role', 'dialog');
    const title = root.querySelector('h2')!;
    const description = root.querySelector('p')!;
    expect(title.textContent).toBe('Hello');
    expect(description.textContent).toBe('World');
    expect(root.getAttribute('aria-labelledby')).toBe(title.id);
    expect(root.getAttribute('aria-describedby')).toBe(description.id);
    // No actionProps → action not rendered.
    expect(root.querySelectorAll('button').length).toBe(1);
    expect(root.style.getPropertyValue('--toast-index')).toBe('0');

    (document.querySelector('[data-testid=add]') as HTMLElement).click();
    flush();
    await tick();
    flush();
    const roots = document.querySelectorAll('[data-testid=root]');
    expect(roots.length).toBe(2);
    // The first root is retained (keyed by id) and moved back one slot.
    expect(roots[1]).toBe(root);
    expect(root.style.getPropertyValue('--toast-index')).toBe('1');

    (root.querySelector('button') as HTMLElement).click();
    flush();
    await tick(50);
    flush();
    expect(document.querySelectorAll('[data-testid=root]').length).toBe(1);
  });

  it('auto-dismisses after the timeout and renders action', async () => {
    mount(() => (
      <Toast.Provider timeout={50}>
        <Adder
          onAdd={(manager) =>
            manager.add({ title: 'Saved', actionProps: { children: 'Undo' } })
          }
        />
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
      </Toast.Provider>
    ));
    (document.querySelector('[data-testid=add]') as HTMLElement).click();
    flush();
    await tick();
    flush();
    const root = document.querySelector('[data-testid=root]') as HTMLElement;
    const buttons = root.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toBe('Undo');
    // Description is empty → not rendered and not referenced.
    expect(root.querySelector('p')).toBeNull();
    expect(root.hasAttribute('aria-describedby')).toBe(false);
    await tick(150);
    flush();
    expect(document.querySelectorAll('[data-testid=root]').length).toBe(0);
  });

  it('supports a global manager and promise toasts', async () => {
    const manager = createToastManager();
    mount(() => (
      <Toast.Provider toastManager={manager}>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
      </Toast.Provider>
    ));
    let resolve!: (value: string) => void;
    manager.promise(new Promise<string>((r) => (resolve = r)), {
      loading: 'Loading…',
      success: (value) => `Done: ${value}`,
      error: 'Failed',
    });
    flush();
    await tick();
    flush();
    const root = document.querySelector('[data-testid=root]') as HTMLElement;
    expect(root.querySelector('p')!.textContent).toBe('Loading…');
    expect(root).toHaveAttribute('data-type', 'loading');
    resolve('ok');
    await tick();
    flush();
    expect(document.querySelector('[data-testid=root]')).toBe(root);
    expect(root.querySelector('p')!.textContent).toBe('Done: ok');
    expect(root).toHaveAttribute('data-type', 'success');
  });
});
