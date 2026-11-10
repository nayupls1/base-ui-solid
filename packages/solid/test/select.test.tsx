import { flush, createSignal } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Select } from '../src/select';

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

const fonts = [
  { label: 'Sans-serif', value: 'sans' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'mono' },
];

function Basic(props: { value?: string; onValueChange?: any; defaultValue?: string; name?: string }) {
  return (
    <Select.Root
      items={fonts}
      value={props.value}
      defaultValue={props.defaultValue}
      onValueChange={props.onValueChange}
      name={props.name}
    >
      <Select.Label>Font</Select.Label>
      <Select.Trigger>
        <Select.Value placeholder="Pick a font" />
        <Select.Icon />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner alignItemWithTrigger={false}>
          <Select.Popup>
            <Select.List>
              {fonts.map((font) => (
                <Select.Item value={font.value}>
                  <Select.ItemIndicator />
                  <Select.ItemText>{font.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

describe('Select', () => {
  afterEach(() => {
    disposers.splice(0).forEach((d) => d());
    document.body.innerHTML = '';
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
  });

  it('shows the placeholder and the selected label', async () => {
    const { container } = mount(() => <Basic defaultValue="serif" />);
    await settle();
    const trigger = container.querySelector('[role=combobox]')!;
    expect(trigger.textContent).toContain('Serif');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    const label = container.querySelector('div')!;
    expect(trigger.getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('opens on mousedown, selects an item on click and closes', async () => {
    const onValueChange = vi.fn();
    const { container } = mount(() => <Basic onValueChange={onValueChange} name="font" />);
    await settle();
    const trigger = container.querySelector('[role=combobox]') as HTMLElement;
    expect(trigger.textContent).toContain('Pick a font');
    expect(trigger).toHaveAttribute('data-placeholder');
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    await settle(40);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = document.querySelector('[role=listbox]') as HTMLElement;
    expect(listbox).not.toBeNull();
    expect(trigger.getAttribute('aria-controls')).toBe(listbox.id);
    const options = Array.from(document.querySelectorAll('[role=option]')) as HTMLElement[];
    expect(options.map((o) => o.textContent)).toEqual(['Sans-serif', 'Serif', 'Monospace']);
    options[2].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
    options[2].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await settle(60);
    expect(onValueChange).toHaveBeenCalledWith('mono', expect.objectContaining({ reason: 'item-press' }));
    expect(trigger.textContent).toContain('Monospace');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    const hidden = container.querySelector('input[name=font]') as HTMLInputElement;
    expect(hidden.value).toBe('mono');
  });

  it('supports controlled value and keyboard navigation', async () => {
    const [value, setValue] = createSignal('sans');
    const { container } = mount(() => <Basic value={value()} onValueChange={setValue} />);
    await settle();
    const trigger = container.querySelector('[role=combobox]') as HTMLElement;
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle(60);
    const options = Array.from(document.querySelectorAll('[role=option]')) as HTMLElement[];
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('data-highlighted');
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle(40);
    expect(options[1]).toHaveAttribute('data-highlighted');
    setValue('mono');
    await settle();
    expect(options[2]).toHaveAttribute('aria-selected', 'true');
  });
});
