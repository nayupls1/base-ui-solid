import { createSignal, flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi } from 'vitest';
import { Switch } from '../src/switch';

function mount(fn: () => any) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = render(fn, container);
  return { container, dispose };
}
const tick = () => new Promise((r) => setTimeout(r, 10));

describe('Switch', () => {
  it('toggles', async () => {
    const onCheckedChange = vi.fn();
    const { container } = mount(() => (
      <Switch.Root onCheckedChange={onCheckedChange} name="s">
        <Switch.Thumb />
      </Switch.Root>
    ));
    const root = container.querySelector('[role=switch]') as HTMLElement;
    const input = container.querySelector('input[type=checkbox]') as HTMLInputElement;
    expect(root).toHaveAttribute('aria-checked', 'false');
    expect(root).toHaveAttribute('data-unchecked');
    expect(root.querySelector('span')).toHaveAttribute('data-unchecked');
    root.click();
    flush();
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
    expect(root).toHaveAttribute('aria-checked', 'true');
    expect(root.querySelector('span')).toHaveAttribute('data-checked');
    expect(input.checked).toBe(true);
  });

  it('controlled rejects change', async () => {
    const [checked] = createSignal(false);
    const { container } = mount(() => <Switch.Root checked={checked()} />);
    const root = container.querySelector('[role=switch]') as HTMLElement;
    const input = container.querySelector('input[type=checkbox]') as HTMLInputElement;
    root.click();
    await tick();
    expect(root).toHaveAttribute('aria-checked', 'false');
    expect(input.checked).toBe(false);
  });
});
