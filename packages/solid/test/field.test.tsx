import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Field } from '../src/field';
import { Form } from '../src/form';
import { Input } from '../src/input';
import { Fieldset } from '../src/fieldset';

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
const tick = () => new Promise((r) => setTimeout(r, 20));

describe('Field + Form', () => {
  it('associates label, description and control', async () => {
    const { container } = mount(() => (
      <Field.Root>
        <Field.Label>Name</Field.Label>
        <Field.Control placeholder="x" />
        <Field.Description>Desc</Field.Description>
      </Field.Root>
    ));
    await tick();
    flush();
    const label = container.querySelector('label')!;
    const input = container.querySelector('input')!;
    const desc = container.querySelector('p')!;
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('aria-labelledby')).toBe(label.id);
    expect(input.getAttribute('aria-describedby')).toBe(desc.id);
  });

  it('validates required on submit and shows error', async () => {
    const onFormSubmit = vi.fn();
    const { container } = mount(() => (
      <Form onFormSubmit={onFormSubmit}>
        <Field.Root name="email">
          <Field.Label>Email</Field.Label>
          <Input required />
          <Field.Error>Required!</Field.Error>
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>
    ));
    await tick();
    const form = container.querySelector('form')!;
    form.requestSubmit();
    await tick();
    flush();
    expect(onFormSubmit).not.toHaveBeenCalled();
    const input = container.querySelector('input')!;
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('data-invalid');
    expect(container.textContent).toContain('Required!');
    input.value = 'hello';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await tick();
    flush();
    expect(input).not.toHaveAttribute('aria-invalid');
    form.requestSubmit();
    await tick();
    expect(onFormSubmit).toHaveBeenCalledWith({ email: 'hello' }, expect.anything());
  });

  it('fieldset disables fields', () => {
    const { container } = mount(() => (
      <Fieldset.Root disabled>
        <Fieldset.Legend>Legend</Fieldset.Legend>
        <Field.Root>
          <Input />
        </Field.Root>
      </Fieldset.Root>
    ));
    const fieldset = container.querySelector('fieldset')!;
    expect(fieldset).toHaveAttribute('data-disabled');
    expect(container.querySelector('input')!.disabled).toBe(true);
    expect(fieldset.getAttribute('aria-labelledby')).toBe(container.querySelector('fieldset > div')!.id);
  });
});
