import { createSignal, flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi } from 'vitest';
import { Toggle } from '../src/toggle';
import { ToggleGroup } from '../src/toggle-group';
import { Toolbar } from '../src/toolbar';
import { Progress } from '../src/progress';
import { Meter } from '../src/meter';
import { Avatar } from '../src/avatar';

function mount(fn: () => any) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = render(fn, container);
  return { container, dispose };
}
const tick = () => new Promise((r) => setTimeout(r, 10));

describe('misc components', () => {
  it('Toggle', () => {
    const { container } = mount(() => <Toggle aria-label="b">B</Toggle>);
    const btn = container.querySelector('button')!;
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    btn.click();
    flush();
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveAttribute('data-pressed');
  });

  it('ToggleGroup single', async () => {
    const onValueChange = vi.fn();
    const { container } = mount(() => (
      <ToggleGroup defaultValue={['a']} onValueChange={onValueChange}>
        <Toggle value="a">A</Toggle>
        <Toggle value="b">B</Toggle>
      </ToggleGroup>
    ));
    await tick();
    const [a, b] = Array.from(container.querySelectorAll('button'));
    expect(a).toHaveAttribute('aria-pressed', 'true');
    b.click();
    flush();
    expect(onValueChange).toHaveBeenCalledWith(['b'], expect.anything());
    expect(a).toHaveAttribute('aria-pressed', 'false');
    expect(b).toHaveAttribute('aria-pressed', 'true');
  });

  it('Toolbar', async () => {
    const { container } = mount(() => (
      <Toolbar.Root>
        <Toolbar.Button>1</Toolbar.Button>
        <Toolbar.Separator />
        <Toolbar.Button disabled>2</Toolbar.Button>
        <Toolbar.Link href="#">3</Toolbar.Link>
      </Toolbar.Root>
    ));
    await tick();
    flush();
    expect(container.querySelector('[role=toolbar]')).toHaveAttribute('aria-orientation', 'horizontal');
    expect(container.querySelector('[role=separator]')).toHaveAttribute('aria-orientation', 'vertical');
    const buttons = container.querySelectorAll('button');
    expect(buttons[0]).toHaveAttribute('tabindex', '0');
    expect(buttons[1]).toHaveAttribute('tabindex', '-1');
    expect(buttons[1]).toHaveAttribute('aria-disabled', 'true');
  });

  it('Progress & Meter', () => {
    const [value, setValue] = createSignal<number | null>(40);
    const { container } = mount(() => (
      <>
        <Progress.Root value={value()}>
          <Progress.Label>Upload</Progress.Label>
          <Progress.Value />
          <Progress.Track>
            <Progress.Indicator />
          </Progress.Track>
        </Progress.Root>
        <Meter.Root value={25}>
          <Meter.Label>Storage</Meter.Label>
          <Meter.Value />
          <Meter.Track>
            <Meter.Indicator />
          </Meter.Track>
        </Meter.Root>
      </>
    ));
    flush();
    const progress = container.querySelector('[role=progressbar]')!;
    expect(progress).toHaveAttribute('aria-valuenow', '40');
    expect(progress).toHaveAttribute('data-progressing');
    expect(progress.getAttribute('aria-labelledby')).toBe(progress.querySelector('span')!.id);
    expect(progress.textContent).toContain('40%');
    const indicator = progress.querySelector(':scope > div > div') as HTMLElement;
    expect(indicator.style.width).toBe('40%');
    setValue(null);
    flush();
    expect(progress).toHaveAttribute('data-indeterminate');
    const meter = container.querySelector('[role=meter]')!;
    expect(meter).toHaveAttribute('aria-valuenow', '25');
    expect(meter.textContent).toContain('25%');
  });

  it('Avatar fallback', () => {
    const { container } = mount(() => (
      <Avatar.Root>
        <Avatar.Image src="" />
        <Avatar.Fallback>AB</Avatar.Fallback>
      </Avatar.Root>
    ));
    flush();
    expect(container.textContent).toBe('AB');
    expect(container.querySelector('img')).toBeNull();
  });
});
