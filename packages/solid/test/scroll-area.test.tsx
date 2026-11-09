import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect } from 'vitest';
import { ScrollArea } from '../src/scroll-area';

describe('ScrollArea', () => {
  it('renders parts', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      () => (
        <ScrollArea.Root class="root">
          <ScrollArea.Viewport class="vp">
            <ScrollArea.Content>Lots of content</ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar keepMounted>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner />
        </ScrollArea.Root>
      ),
      container,
    );
    await new Promise((r) => setTimeout(r, 10));
    flush();
    const root = container.querySelector('.root') as HTMLElement;
    expect(root).toHaveAttribute('role', 'presentation');
    const viewport = container.querySelector('.vp') as HTMLElement;
    expect(viewport).toHaveClass('base-ui-disable-scrollbar');
    expect(viewport.style.overflow).toBe('scroll');
    expect(container.querySelector('[data-orientation=vertical]')).not.toBeNull();
    expect(document.head.querySelector('style[data-base-ui-style]')).not.toBeNull();
  });
});
