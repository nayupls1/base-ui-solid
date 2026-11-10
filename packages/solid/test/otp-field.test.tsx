import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { OTPField } from '../src/otp-field';

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
function type(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

describe('OTPField', () => {
  afterEach(() => {
    disposers.splice(0).forEach((d) => d());
    document.body.innerHTML = '';
  });

  it('fills slots, moves focus and completes', async () => {
    const onValueChange = vi.fn();
    const onValueComplete = vi.fn();
    const { container } = mount(() => (
      <OTPField.Root length={4} onValueChange={onValueChange} onValueComplete={onValueComplete} name="code">
        <OTPField.Input />
        <OTPField.Input aria-label="Digit 2" />
        <OTPField.Input aria-label="Digit 3" />
        <OTPField.Input aria-label="Digit 4" />
      </OTPField.Root>
    ));
    await settle();
    const inputs = Array.from(container.querySelectorAll('input:not([name])')) as HTMLInputElement[];
    expect(inputs.length).toBe(4);
    expect(inputs.map((i) => i.tabIndex)).toEqual([0, -1, -1, -1]);
    inputs[0].focus();
    type(inputs[0], '1');
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith('1', expect.anything());
    expect(document.activeElement).toBe(inputs[1]);
    type(inputs[1], 'x');
    await settle();
    expect(inputs[1].value).toBe('');
    type(inputs[1], '234');
    await settle();
    expect(inputs.map((i) => i.value)).toEqual(['1', '2', '3', '4']);
    expect(onValueComplete).toHaveBeenCalledWith('1234', expect.anything());
    expect((container.querySelector('input[name=code]') as HTMLInputElement).value).toBe('1234');
    inputs[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    await settle();
    expect(inputs[3].value).toBe('');
  });
});
