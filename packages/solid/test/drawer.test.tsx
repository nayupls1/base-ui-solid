import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Drawer } from '../src/drawer';

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
async function settle() {
  flush();
  await tick();
  flush();
}

function TestDrawer(props: { onOpenChange?: (open: boolean, details: any) => void }) {
  return (
    <Drawer.Provider>
      <Drawer.IndentBackground data-testid="indent-bg" />
      <Drawer.Indent data-testid="indent">
        <Drawer.Root onOpenChange={props.onOpenChange}>
          <Drawer.Trigger>Open drawer</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup">
                <Drawer.Content>
                  <Drawer.Title>Notifications</Drawer.Title>
                  <Drawer.Description>You are all caught up.</Drawer.Description>
                  <Drawer.Close>Close</Drawer.Close>
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Indent>
    </Drawer.Provider>
  );
}

describe('Drawer', () => {
  afterEach(() => {
    disposeAll();
    document.body.innerHTML = '';
  });

  it('opens, labels and closes', async () => {
    const onOpenChange = vi.fn();
    const { container } = mount(() => <TestDrawer onOpenChange={onOpenChange} />);
    const indent = container.querySelector('[data-testid=indent]')!;
    expect(indent).toHaveAttribute('data-inactive');
    const trigger = container.querySelector('button')!;
    trigger.click();
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ reason: 'trigger-press' }),
    );
    const popup = document.querySelector('[data-testid=popup]') as HTMLElement;
    expect(popup).toHaveAttribute('role', 'dialog');
    expect(popup).toHaveAttribute('data-swipe-direction', 'down');
    expect(popup.getAttribute('aria-labelledby')).toBe(popup.querySelector('h2')!.id);
    expect(popup.getAttribute('aria-describedby')).toBe(popup.querySelector('p')!.id);
    expect(popup.querySelector('[data-drawer-content]')).not.toBeNull();
    expect(indent).toHaveAttribute('data-active');
    expect(container.querySelector('[data-testid=indent-bg]')).toHaveAttribute('data-active');
    expect(document.querySelector('[data-testid=backdrop]')).not.toBeNull();

    (popup.querySelector('button') as HTMLElement).click();
    await settle();
    await tick(50);
    flush();
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: 'close-press' }),
    );
    expect(document.querySelector('[data-testid=popup]')).toBeNull();
    expect(indent).toHaveAttribute('data-inactive');
  });

  it('closes on Escape', async () => {
    const onOpenChange = vi.fn();
    const { container } = mount(() => <TestDrawer onOpenChange={onOpenChange} />);
    container.querySelector('button')!.click();
    await settle();
    const popup = document.querySelector('[data-testid=popup]') as HTMLElement;
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: 'escape-key' }),
    );
  });
});
