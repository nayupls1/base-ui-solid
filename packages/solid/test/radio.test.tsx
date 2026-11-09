import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Radio } from '../src/radio';
import { RadioGroup } from '../src/radio-group';

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

describe('RadioGroup', () => {
  it('selects and roves focus', async () => {
    const onValueChange = vi.fn();
    const { container } = mount(() => (
      <RadioGroup defaultValue="a" onValueChange={onValueChange}>
        <Radio.Root value="a"><Radio.Indicator /></Radio.Root>
        <Radio.Root value="b"><Radio.Indicator /></Radio.Root>
        <Radio.Root value="c"><Radio.Indicator /></Radio.Root>
      </RadioGroup>
    ));
    await tick();
    flush();
    const radios = Array.from(container.querySelectorAll('[role=radio]')) as HTMLElement[];
    expect(container.querySelector('[role=radiogroup]')).not.toBeNull();
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('tabindex', '0');
    expect(radios[1]).toHaveAttribute('tabindex', '-1');
    expect(radios[0].querySelector('span')).toHaveAttribute('data-checked');
    radios[1].click();
    flush();
    expect(onValueChange).toHaveBeenCalledWith('b', expect.anything());
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    radios[1].focus();
    radios[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await tick();
    flush();
    expect(document.activeElement).toBe(radios[2]);
    expect(radios[2]).toHaveAttribute('aria-checked', 'true');
  });
});
