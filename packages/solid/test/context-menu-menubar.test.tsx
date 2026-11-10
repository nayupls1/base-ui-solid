import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, afterEach } from 'vitest';
import { ContextMenu } from '../src/context-menu';
import { Menubar } from '../src/menubar';
import { Menu } from '../src/menu';

const disposers: Array<() => void> = [];
function mount(fn: () => any) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  disposers.push(render(fn, container));
  return { container };
}
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
async function settle(ms = 20) {
  flush();
  await tick(ms);
  flush();
}

afterEach(() => {
  disposers.splice(0).forEach((d) => d());
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
  document.documentElement.removeAttribute('style');
});

describe('ContextMenu', () => {
  it('opens on contextmenu at the pointer', async () => {
    const { container } = mount(() => (
      <ContextMenu.Root>
        <ContextMenu.Trigger data-testid="area">Right click here</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup>
              <ContextMenu.Item>Back</ContextMenu.Item>
              <ContextMenu.Item>Forward</ContextMenu.Item>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));
    const area = container.querySelector('[data-testid=area]')!;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 60 });
    area.dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(document.querySelector('[role=menu]')).not.toBeNull();
    expect(area).toHaveAttribute('data-popup-open');
    expect(document.querySelectorAll('[role=menuitem]').length).toBe(2);
  });
});

describe('Menubar', () => {
  it('renders a menubar with menuitem triggers and roving focus', async () => {
    const { container } = mount(() => (
      <Menubar>
        <Menu.Root>
          <Menu.Trigger>File</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>New</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <Menu.Root>
          <Menu.Trigger>Edit</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Undo</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menubar>
    ));
    await settle();
    const bar = container.querySelector('[role=menubar]')!;
    expect(bar).toHaveAttribute('aria-orientation', 'horizontal');
    const triggers = Array.from(container.querySelectorAll('[role=menuitem]')) as HTMLElement[];
    expect(triggers.map((t) => t.textContent)).toEqual(['File', 'Edit']);
    expect(triggers[0]).toHaveAttribute('aria-haspopup', 'menu');
    triggers[0].focus();
    triggers[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle();
    expect(document.activeElement).toBe(triggers[1]);
    triggers[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    triggers[1].dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
    await settle();
    expect(document.body.textContent).toContain('Undo');
    expect(bar).toHaveAttribute('data-has-submenu-open');
  });
});
