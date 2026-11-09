import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Tabs } from '../src/tabs';

function mount(fn: () => any) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = render(fn, container);
  disposers.push(dispose);
  return { container, dispose };
}
const disposers: Array<() => void> = [];
afterEach(() => disposeAll());
function disposeAll() {
  disposers.splice(0).forEach((dispose) => dispose());
}
const tick = () => new Promise((r) => setTimeout(r, 10));

describe('Tabs', () => {
  it('switches panels', async () => {
    const onValueChange = vi.fn();
    const { container } = mount(() => (
      <Tabs.Root defaultValue="a" onValueChange={onValueChange}>
        <Tabs.List>
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b">B</Tabs.Tab>
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Panel value="a">Panel A</Tabs.Panel>
        <Tabs.Panel value="b">Panel B</Tabs.Panel>
      </Tabs.Root>
    ));
    await tick();
    flush();
    const tabs = Array.from(container.querySelectorAll('[role=tab]')) as HTMLElement[];
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('data-active');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    const panels = container.querySelectorAll('[role=tabpanel]');
    expect(panels.length).toBe(1);
    expect(panels[0].textContent).toBe('Panel A');
    expect(panels[0].getAttribute('aria-labelledby')).toBe(tabs[0].id);
    expect(tabs[0].getAttribute('aria-controls')).toBe(panels[0].id);
    tabs[1].click();
    flush();
    await tick();
    flush();
    expect(onValueChange).toHaveBeenCalledWith('b', expect.anything());
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    const panelsAfter = container.querySelectorAll('[role=tabpanel]');
    expect(panelsAfter.length).toBe(1);
    expect(panelsAfter[0].textContent).toBe('Panel B');
    // keyboard navigation
    tabs[1].focus();
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await tick();
    expect(document.activeElement).toBe(tabs[0]);
  });
});
