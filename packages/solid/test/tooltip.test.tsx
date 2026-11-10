import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Tooltip } from '../src/tooltip';

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

function hover(el: Element) {
  el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false, pointerType: 'mouse' }));
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
}
function unhover(el: Element) {
  el.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false, pointerType: 'mouse' }));
  el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
}

function Basic(props: { delay?: number; onOpenChange?: any }) {
  return (
    <Tooltip.Root onOpenChange={props.onOpenChange}>
      <Tooltip.Trigger delay={props.delay}>Trigger</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>
            <Tooltip.Arrow />
            Tip
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

describe('Tooltip', () => {
  afterEach(() => {
    disposers.splice(0).forEach((d) => d());
    document.body.innerHTML = '';
  });

  it('opens on hover after the delay and closes on leave', async () => {
    const onOpenChange = vi.fn();
    const { container } = mount(() => <Basic delay={30} onOpenChange={onOpenChange} />);
    const trigger = container.querySelector('button')!;
    expect(trigger).toHaveAttribute('data-base-ui-tooltip-trigger');
    hover(trigger);
    await settle(5);
    expect(document.body.textContent).not.toContain('Tip');
    await settle(60);
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'trigger-hover' }));
    const popup = document.querySelector('[data-open]:not(button)') as HTMLElement;
    expect(popup?.textContent).toContain('Tip');
    expect(trigger).toHaveAttribute('data-popup-open');
    unhover(trigger);
    await settle(50);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
    await settle(20);
    expect(document.body.textContent).not.toContain('Tip');
  });

  it('opens on keyboard focus and closes on Escape', async () => {
    const { container } = mount(() => <Basic />);
    const trigger = container.querySelector('button')!;
    // Base UI only opens on focus-visible; simulate keyboard modality.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    trigger.focus();
    await settle();
    expect(document.body.textContent).toContain('Tip');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(40);
    expect(document.body.textContent).not.toContain('Tip');
  });

  it('supports controlled open and placement data attributes', async () => {
    mount(() => (
      <Tooltip.Root open>
        <Tooltip.Trigger>Trigger</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side="bottom" data-testid="positioner">
            <Tooltip.Popup>Tip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    await settle();
    const positioner = document.querySelector('[data-testid=positioner]')!;
    expect(positioner).toHaveAttribute('data-side', 'bottom');
    expect(positioner).toHaveAttribute('role', 'presentation');
  });

  it('opens adjacent tooltips instantly inside a provider', async () => {
    const { container } = mount(() => (
      <Tooltip.Provider delay={30}>
        <Basic />
        <Basic />
      </Tooltip.Provider>
    ));
    const [a, b] = Array.from(container.querySelectorAll('button'));
    hover(a);
    await settle(60);
    expect(document.querySelectorAll('[data-base-ui-focusable][data-open]').length).toBe(1);
    unhover(a);
    hover(b);
    await settle(5);
    expect(b).toHaveAttribute('data-popup-open');
  });
});
