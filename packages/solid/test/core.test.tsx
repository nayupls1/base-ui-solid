import { createSignal, flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../src/button';
import { Separator } from '../src/separator';
import { useRender } from '../src/use-render';

function mount(fn: () => any) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = render(fn, container);
  return { container, dispose };
}

describe('core rendering', () => {
  it('renders Button with defaults', () => {
    const onClick = vi.fn();
    const { container } = mount(() => <Button onClick={onClick} class="btn">Hi</Button>);
    const button = container.querySelector('button')!;
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('btn');
    expect(button.textContent).toBe('Hi');
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reacts to disabled and class function', () => {
    const [disabled, setDisabled] = createSignal(false);
    const onClick = vi.fn();
    const { container } = mount(() => (
      <Button
        disabled={disabled()}
        onClick={onClick}
        class={(state) => (state.disabled ? 'off' : 'on')}
      >
        Hi
      </Button>
    ));
    const button = container.querySelector('button')!;
    expect(button).toHaveClass('on');
    expect(button).not.toHaveAttribute('data-disabled');
    setDisabled(true);
    flush();
    expect(button).toHaveClass('off');
    expect(button).toHaveAttribute('data-disabled');
    expect(button.disabled).toBe(true);
  });

  it('supports focusableWhenDisabled with aria-disabled string', () => {
    const { container } = mount(() => (
      <Button disabled focusableWhenDisabled>
        Hi
      </Button>
    ));
    const button = container.querySelector('button')!;
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button.disabled).toBe(false);
  });

  it('render prop: tag string, function, and element', () => {
    const { container } = mount(() => (
      <>
        <Separator render="hr" />
        <Button render={(props) => <span data-fn {...props} />} nativeButton={false}>
          A
        </Button>
        <Button render={<a href="/x" class="own" />} nativeButton={false} class="ours">
          B
        </Button>
      </>
    ));
    expect(container.querySelector('hr')).toHaveAttribute('role', 'separator');
    expect(container.querySelector('hr')).toHaveAttribute('aria-orientation', 'horizontal');
    const span = container.querySelector('span[data-fn]')!;
    expect(span).toHaveAttribute('role', 'button');
    expect(span.textContent).toBe('A');
    const a = container.querySelector('a')!;
    expect(a).toHaveAttribute('href', '/x');
    expect(a.getAttribute('class')).toBe('own ours');
    expect(a.textContent).toBe('B');
    expect(a).toHaveAttribute('role', 'button');
  });

  it('render function picks up keys added later', () => {
    const [disabled, setDisabled] = createSignal(false);
    const { container } = mount(() => (
      <Button
        disabled={disabled()}
        nativeButton={false}
        render={(props, state) => <span data-state={String(state.disabled)} {...props} />}
      />
    ));
    const span = container.querySelector('span')!;
    expect(span).not.toHaveAttribute('data-disabled');
    expect(span).toHaveAttribute('data-state', 'false');
    setDisabled(true);
    flush();
    expect(span).toHaveAttribute('data-disabled');
    expect(span).toHaveAttribute('aria-disabled', 'true');
    expect(span).toHaveAttribute('data-state', 'true');
  });

  it('useRender', () => {
    function Custom(props: { label: string }) {
      return useRender({
        defaultTagName: 'p',
        state: () => ({ active: true }),
        props: { class: 'x', get children() { return props.label; } },
      });
    }
    const { container } = mount(() => <Custom label="hello" />);
    const p = container.querySelector('p')!;
    expect(p).toHaveClass('x');
    expect(p).toHaveAttribute('data-active');
    expect(p.textContent).toBe('hello');
  });
});
