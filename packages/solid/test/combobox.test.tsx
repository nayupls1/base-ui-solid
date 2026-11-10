import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Combobox } from '../src/combobox';

function mount(fn: () => any) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = render(fn, container);
  disposers.push(dispose);
  return { container, dispose };
}
const disposers: Array<() => void> = [];
function disposeAll() {
  disposers.splice(0).forEach((dispose) => dispose());
}
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
async function settle() {
  flush();
  await tick();
  flush();
}
function typeInto(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
}

const fruits = ['Apple', 'Banana', 'Cherry', 'Grape'];

function Fruits(props: { onValueChange?: (value: any, details: any) => void; multiple?: boolean }) {
  return (
    <Combobox.Root items={fruits} onValueChange={props.onValueChange} multiple={props.multiple}>
      <Combobox.Input data-testid="input" />
      <Combobox.Trigger data-testid="trigger">▼</Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup data-testid="popup">
            <Combobox.Empty data-testid="empty">No fruits</Combobox.Empty>
            <Combobox.List>
              {(item: string) => (
                <Combobox.Item value={item}>
                  <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
                  {item}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

const options = () =>
  [...document.querySelectorAll('[role=option]')].map((el) => el.textContent!.trim());

describe('Combobox', () => {
  afterEach(() => {
    disposeAll();
    document.body.innerHTML = '';
  });

  it('renders combobox semantics', () => {
    const { container } = mount(() => <Fruits />);
    const input = container.querySelector('[data-testid=input]') as HTMLInputElement;
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('filters while typing and selects with Enter', async () => {
    const onValueChange = vi.fn();
    const { container } = mount(() => <Fruits onValueChange={onValueChange} />);
    const input = container.querySelector('[data-testid=input]') as HTMLInputElement;
    input.focus();
    typeInto(input, 'an');
    await settle();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(options()).toEqual(['Banana']);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    const activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).not.toBeNull();
    expect(document.getElementById(activeId!)!.textContent).toContain('Banana');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    await tick(50);
    flush();
    expect(onValueChange).toHaveBeenLastCalledWith(
      'Banana',
      expect.objectContaining({ reason: 'item-press' }),
    );
    expect(input.value).toBe('Banana');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the empty state', async () => {
    const { container } = mount(() => <Fruits />);
    const input = container.querySelector('[data-testid=input]') as HTMLInputElement;
    input.focus();
    typeInto(input, 'zzz');
    await settle();
    expect(options()).toEqual([]);
    expect(document.querySelector('[data-testid=empty]')!.textContent).toContain('No fruits');
  });

  it('opens from the trigger and selects by click', async () => {
    const onValueChange = vi.fn();
    const { container } = mount(() => <Fruits onValueChange={onValueChange} />);
    const trigger = container.querySelector('[data-testid=trigger]') as HTMLElement;
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    await settle();
    expect(options()).toEqual(fruits);
    const cherry = [...document.querySelectorAll('[role=option]')][2] as HTMLElement;
    cherry.click();
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith('Cherry', expect.anything());
    const input = container.querySelector('[data-testid=input]') as HTMLInputElement;
    expect(input.value).toBe('Cherry');
  });
});
