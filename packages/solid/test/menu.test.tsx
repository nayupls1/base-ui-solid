import { flush, createSignal } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
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
function key(target: Element, k: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

describe('Menu', () => {
  afterEach(() => {
    disposers.splice(0).forEach((d) => d());
    document.body.innerHTML = '';
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
  });

  it('opens on click and renders items with roles', async () => {
    const onOpenChange = vi.fn();
    const onClick = vi.fn();
    const { container } = mount(() => (
      <Menu.Root onOpenChange={onOpenChange}>
        <Menu.Trigger>Song</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item onClick={onClick}>Add to Library</Menu.Item>
              <Menu.Item>Add to Playlist</Menu.Item>
              <Menu.Separator />
              <Menu.Item disabled>Play Next</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    const trigger = container.querySelector('button')!;
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
    await settle();
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything());
    const menu = document.querySelector('[role=menu]') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
    expect(menu.getAttribute('aria-labelledby')).toBe(trigger.id);
    const items = Array.from(document.querySelectorAll('[role=menuitem]'));
    expect(items.map((i) => i.textContent)).toEqual(['Add to Library', 'Add to Playlist', 'Play Next']);
    expect(items[2]).toHaveAttribute('aria-disabled', 'true');
    expect(document.querySelector('[role=separator]')).not.toBeNull();
    (items[0] as HTMLElement).click();
    await settle(40);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'item-press' }));
  });

  it('navigates with the keyboard and supports typeahead', async () => {
    const { container } = mount(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Apple</Menu.Item>
              <Menu.Item>Banana</Menu.Item>
              <Menu.Item>Cherry</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    const trigger = container.querySelector('button')!;
    trigger.focus();
    key(trigger, 'ArrowDown');
    await settle(40);
    const items = Array.from(document.querySelectorAll('[role=menuitem]')) as HTMLElement[];
    expect(items.length).toBe(3);
    expect(items[0]).toHaveAttribute('data-highlighted');
    key(document.activeElement!, 'ArrowDown');
    await settle(40);
    expect(items[1]).toHaveAttribute('data-highlighted');
    expect(document.activeElement).toBe(items[1]);
    key(document.activeElement!, 'c');
    await settle(40);
    expect(items[2]).toHaveAttribute('data-highlighted');
    key(document.activeElement!, 'Escape');
    await settle(60);
    expect(document.querySelector('[role=menu]')).toBeNull();
  });

  it('supports checkbox and radio items', async () => {
    const [value, setValue] = createSignal('a');
    mount(() => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.CheckboxItem defaultChecked>
                <Menu.CheckboxItemIndicator data-testid="cb-indicator" />
                Shuffle
              </Menu.CheckboxItem>
              <Menu.RadioGroup value={value()} onValueChange={setValue}>
                <Menu.GroupLabel>Sort</Menu.GroupLabel>
                <Menu.RadioItem value="a">A</Menu.RadioItem>
                <Menu.RadioItem value="b">
                  <Menu.RadioItemIndicator data-testid="radio-b" />B
                </Menu.RadioItem>
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    await settle();
    const checkbox = document.querySelector('[role=menuitemcheckbox]') as HTMLElement;
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
    expect(document.querySelector('[data-testid=cb-indicator]')).not.toBeNull();
    checkbox.click();
    await settle();
    expect(checkbox).toHaveAttribute('aria-checked', 'false');
    const group = document.querySelector('[role=group]') as HTMLElement;
    expect(group.getAttribute('aria-labelledby')).toBe(
      Array.from(document.querySelectorAll('[aria-hidden=true]')).find((e) => e.textContent === 'Sort')?.id,
    );
    const radios = Array.from(document.querySelectorAll('[role=menuitemradio]')) as HTMLElement[];
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(document.querySelector('[data-testid=radio-b]')).toBeNull();
    radios[1].click();
    await settle();
    expect(value()).toBe('b');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(document.querySelector('[data-testid=radio-b]')).not.toBeNull();
  });

  it('opens a submenu with ArrowRight', async () => {
    mount(() => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>One</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>Nested</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    await settle();
    const subTrigger = Array.from(document.querySelectorAll('[role=menuitem]')).find(
      (e) => e.textContent === 'More',
    ) as HTMLElement;
    expect(subTrigger).toHaveAttribute('aria-haspopup', 'menu');
    subTrigger.focus();
    key(subTrigger, 'ArrowRight');
    await settle(60);
    expect(document.querySelectorAll('[role=menu]').length).toBe(2);
    expect(document.body.textContent).toContain('Nested');
  });
});
