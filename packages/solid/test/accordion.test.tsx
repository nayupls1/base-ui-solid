import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Accordion } from '../src/accordion';

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
const tick = () => new Promise((r) => setTimeout(r, 30));

describe('Accordion', () => {
  it('opens one panel at a time', async () => {
    const onValueChange = vi.fn();
    const { container } = mount(() => (
      <Accordion.Root onValueChange={onValueChange}>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel A</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Header>
            <Accordion.Trigger>B</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel B</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    await tick();
    const [a, b] = Array.from(container.querySelectorAll('button'));
    const items = container.querySelectorAll('h3');
    expect(items[0]).toHaveAttribute('data-index', '0');
    expect(items[1]).toHaveAttribute('data-index', '1');
    a.click();
    flush();
    expect(onValueChange).toHaveBeenLastCalledWith(['a'], expect.anything());
    expect(a).toHaveAttribute('aria-expanded', 'true');
    const region = container.querySelector('[role=region]')!;
    expect(region.textContent).toBe('Panel A');
    expect(region.getAttribute('aria-labelledby')).toBe(a.id);
    b.click();
    flush();
    await tick();
    flush();
    expect(a).toHaveAttribute('aria-expanded', 'false');
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelectorAll('[role=region]').length).toBe(1);
  });

  it('multiple + defaultValue', () => {
    const { container } = mount(() => (
      <Accordion.Root multiple defaultValue={['a', 'b']}>
        <Accordion.Item value="a">
          <Accordion.Trigger>A</Accordion.Trigger>
          <Accordion.Panel>Panel A</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Trigger>B</Accordion.Trigger>
          <Accordion.Panel>Panel B</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    expect(container.querySelectorAll('[role=region]').length).toBe(2);
  });
});
