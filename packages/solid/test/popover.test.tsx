import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Popover } from '../src/popover';

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

describe('Popover', () => {
  afterEach(() => {
    disposeAll();
    document.body.innerHTML = '';
  });

  it('opens and closes', async () => {
    const onOpenChange = vi.fn();
    const { container } = mount(() => (
      <Popover.Root onOpenChange={onOpenChange}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={8}>
            <Popover.Popup>
              <Popover.Arrow />
              <Popover.Title>Title</Popover.Title>
              <Popover.Description>Desc</Popover.Description>
              <Popover.Close>Close</Popover.Close>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    const trigger = container.querySelector('button')!;
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    trigger.click();
    flush();
    await tick();
    flush();
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const popup = document.querySelector('[role=dialog]') as HTMLElement;
    expect(popup).not.toBeNull();
    expect(popup.textContent).toContain('Title');
    expect(popup.getAttribute('aria-labelledby')).toBe(document.querySelector('h2')!.id);
    expect(popup.getAttribute('aria-describedby')).toBe(document.querySelector('p')!.id);
    expect(trigger.getAttribute('aria-controls')).toBe(popup.id);
    expect(popup).toHaveAttribute('data-open');
    // Close via Close button
    (popup.querySelector('button') as HTMLElement).click();
    flush();
    await tick();
    flush();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });

  it('closes on Escape and outside press', async () => {
    const { container } = mount(() => (
      <>
        <button id="outside">outside</button>
        <Popover.Root>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </>
    ));
    const trigger = container.querySelectorAll('button')[1]!;
    trigger.click();
    flush();
    await tick();
    flush();
    expect(document.querySelector('[role=dialog]')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flush();
    await tick();
    flush();
    expect(document.querySelector('[role=dialog]')).toBeNull();
    trigger.click();
    flush();
    await tick();
    flush();
    expect(document.querySelector('[role=dialog]')).not.toBeNull();
    const outside = document.getElementById('outside')!;
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    outside.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
    flush();
    await tick();
    flush();
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
