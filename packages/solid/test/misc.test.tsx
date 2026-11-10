import { createSignal, flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { reset as resetLogOnce } from 'base-ui-solidjs-utils/warn';
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
  disposers.push(dispose);
  return { container, dispose };
}
const disposers: Array<() => void> = [];
afterEach(() => disposeAll());
function disposeAll() {
  disposers.splice(0).forEach((dispose) => dispose());
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

  it('Toggle render function updates content from state in JSX', () => {
    resetLogOnce();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = mount(() => (
      <Toggle
        aria-label="fav"
        render={(props, state) => (
          <button type="button" {...props}>
            {state.pressed ? <b>on</b> : <i>off</i>}
          </button>
        )}
      />
    ));
    const btn = container.querySelector('button')!;
    expect(btn.textContent).toBe('off');
    btn.click();
    flush();
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn.textContent).toBe('on');
    // The same element is kept, so focus isn't lost.
    expect(container.querySelector('button')).toBe(btn);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns when a render function reads state outside JSX', () => {
    resetLogOnce();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount(() => (
      <Toggle
        aria-label="fav2"
        render={(props, state) => {
          const label = state.pressed ? 'on' : 'off';
          return (
            <button type="button" {...props}>
              {label}
            </button>
          );
        }}
      />
    ));
    expect(
      warnSpy.mock.calls.some((args) => String(args.join(' ')).includes('state.pressed')),
    ).toBe(true);
    warnSpy.mockRestore();
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
    expect(container.querySelector('[role=toolbar]')).toHaveAttribute(
      'aria-orientation',
      'horizontal',
    );
    expect(container.querySelector('[role=separator]')).toHaveAttribute(
      'aria-orientation',
      'vertical',
    );
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
