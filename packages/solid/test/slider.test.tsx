import { flush, createSignal } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Slider } from '../src/slider';

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

describe('Slider', () => {
  afterEach(() => {
    disposers.splice(0).forEach((d) => d());
    document.body.innerHTML = '';
  });

  it('renders a range input with ARIA values and changes with the keyboard', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();
    const { container } = mount(() => (
      <Slider.Root defaultValue={25} onValueChange={onValueChange} onValueCommitted={onValueCommitted}>
        <Slider.Value data-testid="value" />
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator data-testid="indicator" />
            <Slider.Thumb aria-label="Volume" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();
    expect(container.firstElementChild).toHaveAttribute('role', 'group');
    const input = container.querySelector('input[type=range]') as HTMLInputElement;
    expect(input).toHaveAttribute('aria-valuenow', '25');
    expect(input).toHaveAttribute('aria-label', 'Volume');
    expect(input.value).toBe('25');
    expect(container.querySelector('[data-testid=value]')!.textContent).toBe('25');
    expect((container.querySelector('[data-testid=indicator]') as HTMLElement).style.width).toBe('25%');
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await settle();
    expect(onValueChange).toHaveBeenCalledWith(26, expect.objectContaining({ reason: 'keyboard' }));
    expect(onValueCommitted).toHaveBeenCalledWith(26, expect.anything());
    expect(input).toHaveAttribute('aria-valuenow', '26');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await settle();
    expect(input).toHaveAttribute('aria-valuenow', '100');
    expect(container.firstElementChild).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('supports range sliders and controlled values', async () => {
    const [value, setValue] = createSignal<number[]>([20, 60]);
    const { container } = mount(() => (
      <Slider.Root value={value()} onValueChange={(v: any) => setValue(v)}>
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator data-testid="indicator" />
            <Slider.Thumb index={0} />
            <Slider.Thumb index={1} />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();
    const inputs = Array.from(container.querySelectorAll('input[type=range]')) as HTMLInputElement[];
    expect(inputs.map((i) => i.getAttribute('aria-valuenow'))).toEqual(['20', '60']);
    expect(inputs[0].getAttribute('aria-valuetext')).toBe('20 start range');
    const indicator = container.querySelector('[data-testid=indicator]') as HTMLElement;
    expect(indicator.style.width).toBe('40%');
    inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    await settle();
    expect(value()).toEqual([20, 59]);
    setValue([10, 90]);
    await settle();
    expect(inputs.map((i) => i.getAttribute('aria-valuenow'))).toEqual(['10', '90']);
  });
});
