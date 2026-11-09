import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Checkbox } from '../src/checkbox';
import { CheckboxGroup } from '../src/checkbox-group';

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

describe('Checkbox', () => {
  it('toggles with indicator', async () => {
    const onCheckedChange = vi.fn();
    const { container } = mount(() => (
      <Checkbox.Root onCheckedChange={onCheckedChange}>
        <Checkbox.Indicator>✓</Checkbox.Indicator>
      </Checkbox.Root>
    ));
    const root = container.querySelector('[role=checkbox]') as HTMLElement;
    expect(root).toHaveAttribute('aria-checked', 'false');
    expect(root.textContent).toBe('');
    root.click();
    flush();
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
    expect(root).toHaveAttribute('aria-checked', 'true');
    expect(root).toHaveAttribute('data-checked');
    expect(root.textContent).toBe('✓');
  });

  it('indeterminate', () => {
    const { container } = mount(() => <Checkbox.Root indeterminate />);
    const root = container.querySelector('[role=checkbox]') as HTMLElement;
    expect(root).toHaveAttribute('aria-checked', 'mixed');
    expect(root).toHaveAttribute('data-indeterminate');
  });

  it('group with parent', async () => {
    const onValueChange = vi.fn();
    const { container } = mount(() => (
      <CheckboxGroup allValues={['a', 'b']} defaultValue={['a']} onValueChange={onValueChange}>
        <Checkbox.Root parent />
        <Checkbox.Root value="a" />
        <Checkbox.Root value="b" />
      </CheckboxGroup>
    ));
    await tick();
    flush();
    const [parent, a, b] = Array.from(container.querySelectorAll('[role=checkbox]')) as HTMLElement[];
    expect(parent).toHaveAttribute('aria-checked', 'mixed');
    expect(a).toHaveAttribute('aria-checked', 'true');
    expect(b).toHaveAttribute('aria-checked', 'false');
    expect(parent.getAttribute('aria-controls')).toBe(`${a.id} ${b.id}`);
    b.click();
    flush();
    expect(onValueChange).toHaveBeenLastCalledWith(['a', 'b'], expect.anything());
    expect(parent).toHaveAttribute('aria-checked', 'true');
    parent.click();
    flush();
    expect(onValueChange).toHaveBeenLastCalledWith([], expect.anything());
    expect(a).toHaveAttribute('aria-checked', 'false');
  });

  it('group without parent', () => {
    const { container } = mount(() => (
      <CheckboxGroup defaultValue={['b']}>
        <Checkbox.Root value="a" />
        <Checkbox.Root value="b" />
      </CheckboxGroup>
    ));
    const [a, b] = Array.from(container.querySelectorAll('[role=checkbox]')) as HTMLElement[];
    expect(b).toHaveAttribute('aria-checked', 'true');
    a.click();
    flush();
    expect(a).toHaveAttribute('aria-checked', 'true');
  });
});
