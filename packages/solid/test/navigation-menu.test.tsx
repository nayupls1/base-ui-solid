import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NavigationMenu } from '../src/navigation-menu';

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

function Menu(props: { onValueChange?: (value: any, details: any) => void }) {
  return (
    <NavigationMenu.Root onValueChange={props.onValueChange}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="overview">
          <NavigationMenu.Trigger>
            Overview
            <NavigationMenu.Icon />
          </NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="overview">
            <NavigationMenu.Link href="#quick-start">Quick start</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="handbook">
          <NavigationMenu.Trigger>Handbook</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="handbook">
            <NavigationMenu.Link href="#styling">Styling</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#github" active>
            GitHub
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner sideOffset={10}>
          <NavigationMenu.Popup data-testid="popup">
            <NavigationMenu.Arrow />
            <NavigationMenu.Viewport data-testid="viewport" />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

describe('NavigationMenu', () => {
  afterEach(() => {
    disposeAll();
    document.body.innerHTML = '';
  });

  it('renders a nav landmark with a list', () => {
    const { container } = mount(() => <Menu />);
    const nav = container.querySelector('nav')!;
    expect(nav).not.toBeNull();
    expect(nav.querySelector('ul')).not.toBeNull();
    expect(nav.querySelectorAll('li').length).toBe(3);
    const [overview] = nav.querySelectorAll('button');
    expect(overview).toHaveAttribute('aria-expanded', 'false');
    expect(overview.textContent).toBe('Overview▼');
    const github = nav.querySelector('a[href="#github"]')!;
    expect(github).toHaveAttribute('aria-current', 'page');
    expect(document.querySelector('[data-testid=popup]')).toBeNull();
  });

  it('opens content in the viewport on click and switches items', async () => {
    const onValueChange = vi.fn();
    const { container } = mount(() => <Menu onValueChange={onValueChange} />);
    const [overview, handbook] = container.querySelectorAll('button');
    overview.click();
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith(
      'overview',
      expect.objectContaining({ reason: 'trigger-press' }),
    );
    expect(overview).toHaveAttribute('aria-expanded', 'true');
    expect(overview).toHaveAttribute('data-popup-open');
    const popup = document.querySelector('[data-testid=popup]') as HTMLElement;
    expect(popup).not.toBeNull();
    expect(overview.getAttribute('aria-controls')).toBe(popup.id);
    const viewport = document.querySelector('[data-testid=viewport]') as HTMLElement;
    expect(viewport.querySelector('[data-testid=overview]')).not.toBeNull();
    expect(viewport.textContent).toContain('Quick start');

    handbook.click();
    await settle();
    expect(handbook).toHaveAttribute('aria-expanded', 'true');
    expect(overview).toHaveAttribute('aria-expanded', 'false');
    await tick(50);
    flush();
    expect(viewport.querySelector('[data-testid=handbook]')).not.toBeNull();
    expect(viewport.querySelector('[data-testid=overview]')).toBeNull();
  });

  it('closes on Escape and returns focus', async () => {
    const onValueChange = vi.fn();
    const { container } = mount(() => <Menu onValueChange={onValueChange} />);
    const [overview] = container.querySelectorAll('button');
    overview.focus();
    overview.click();
    await settle();
    expect(document.querySelector('[data-testid=popup]')).not.toBeNull();
    const link = document.querySelector('a[href="#quick-start"]') as HTMLElement;
    link.focus();
    link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    await tick(50);
    flush();
    expect(onValueChange).toHaveBeenLastCalledWith(
      null,
      expect.objectContaining({ reason: 'escape-key' }),
    );
    expect(overview).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[data-testid=popup]')).toBeNull();
    expect(document.activeElement).toBe(overview);
  });

  it('opens with ArrowDown', async () => {
    const { container } = mount(() => <Menu />);
    const [overview] = container.querySelectorAll('button');
    overview.focus();
    overview.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect(overview).toHaveAttribute('aria-expanded', 'true');
  });
});
