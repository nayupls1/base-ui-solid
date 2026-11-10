import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PreviewCard } from '../src/preview-card';

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

describe('PreviewCard', () => {
  afterEach(() => {
    disposers.splice(0).forEach((d) => d());
    document.body.innerHTML = '';
  });

  it('opens on hover after the delay and closes after the close delay', async () => {
    const onOpenChange = vi.fn();
    const { container } = mount(() => (
      <PreviewCard.Root onOpenChange={onOpenChange}>
        <PreviewCard.Trigger href="#x" delay={20} closeDelay={20}>
          Link
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup>
              <PreviewCard.Arrow />
              Card
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    const trigger = container.querySelector('a')!;
    expect(trigger.getAttribute('href')).toBe('#x');
    trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await settle(60);
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'trigger-hover' }));
    expect(document.body.textContent).toContain('Card');
    expect(trigger).toHaveAttribute('data-popup-open');
    trigger.dispatchEvent(new MouseEvent('mouseleave'));
    await settle(80);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
  });
});
