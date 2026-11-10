import { flush, createSignal } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NumberField } from '../src/number-field';

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

function Basic(props: { defaultValue?: number; value?: number | null; onValueChange?: any; min?: number; max?: number; name?: string }) {
  return (
    <NumberField.Root
      defaultValue={props.defaultValue}
      value={props.value}
      onValueChange={props.onValueChange}
      min={props.min}
      max={props.max}
      name={props.name}
    >
      <NumberField.Group>
        <NumberField.Decrement>-</NumberField.Decrement>
        <NumberField.Input />
        <NumberField.Increment>+</NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );
}

describe('NumberField', () => {
  afterEach(() => {
    disposers.splice(0).forEach((d) => d());
    document.body.innerHTML = '';
  });

  it('increments and decrements with the buttons and keyboard', async () => {
    const onValueChange = vi.fn();
    const { container } = mount(() => <Basic defaultValue={5} onValueChange={onValueChange} name="qty" />);
    await settle();
    const input = container.querySelector('input[type=text]') as HTMLInputElement;
    expect(input.value).toBe('5');
    expect(input).toHaveAttribute('aria-roledescription', 'Number field');
    const [dec, inc] = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
    expect(inc).toHaveAttribute('aria-label', 'Increase');
    inc.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    await settle();
    expect(onValueChange).toHaveBeenCalledWith(6, expect.objectContaining({ reason: 'increment-press' }));
    expect(input.value).toBe('6');
    dec.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    await settle();
    expect(input.value).toBe('5');
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    await settle();
    expect(input.value).toBe('6');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true, cancelable: true }));
    await settle();
    expect(input.value).toBe('16');
    const hidden = container.querySelector('input[name=qty]') as HTMLInputElement;
    expect(hidden.value).toBe('16');
  });

  it('parses typed text, clamps on blur and disables buttons at the bounds', async () => {
    const [value, setValue] = createSignal<number | null>(1);
    const { container } = mount(() => <Basic value={value()} onValueChange={setValue} min={0} max={10} />);
    await settle();
    const input = container.querySelector('input[type=text]') as HTMLInputElement;
    input.focus();
    input.value = '42';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await settle();
    expect(value()).toBe(10);
    input.dispatchEvent(new FocusEvent('blur'));
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await settle();
    expect(input.value).toBe('10');
    const inc = container.querySelectorAll('button')[1] as HTMLButtonElement;
    expect(inc).toHaveAttribute('disabled');
    input.value = '12a';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await settle();
    expect(input.value).toBe('10');
  });
});
