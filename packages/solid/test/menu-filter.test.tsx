import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Menu } from '../src/menu';

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
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

function FilterMenu(props: { onValueChange?: (value: string, details: any) => void }) {
  return (
    <Menu.FilterProvider onValueChange={props.onValueChange}>
      <Menu.Root>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="popup">
              <Menu.Input aria-label="Filter actions" />
              <Menu.Clear data-testid="clear">x</Menu.Clear>
              <Menu.Empty data-testid="empty">No actions found.</Menu.Empty>
              <Menu.List>
                <Menu.Group data-testid="file">
                  <Menu.GroupLabel>File</Menu.GroupLabel>
                  <Menu.Item>New file</Menu.Item>
                  <Menu.Item>Save</Menu.Item>
                  <Menu.Item>Save as</Menu.Item>
                </Menu.Group>
                <Menu.Group data-testid="edit">
                  <Menu.GroupLabel>Edit</Menu.GroupLabel>
                  <Menu.Item>Undo</Menu.Item>
                  <Menu.Item label="Redo">Redo ⇧⌘Z</Menu.Item>
                </Menu.Group>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  );
}

const itemTexts = () =>
  [...document.querySelectorAll('[data-testid=popup] [role=menuitem]')].map((el) =>
    el.textContent!.trim(),
  );

describe('Menu filtering', () => {
  afterEach(() => {
    disposeAll();
    document.body.innerHTML = '';
  });

  it('filters items, hides empty groups and shows the empty state', async () => {
    const onValueChange = vi.fn();
    const { container } = mount(() => <FilterMenu onValueChange={onValueChange} />);
    const trigger = container.querySelector('button')!;
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    trigger.click();
    await settle();
    const popup = document.querySelector('[data-testid=popup]') as HTMLElement;
    expect(popup).toHaveAttribute('role', 'dialog');
    const input = popup.querySelector('input')!;
    expect(input).toHaveAttribute('role', 'searchbox');
    expect(itemTexts()).toEqual(['New file', 'Save', 'Save as', 'Undo', 'Redo ⇧⌘Z']);
    expect(document.querySelector('[data-testid=clear]')).toBeNull();
    expect(document.querySelector('[data-testid=empty]')).toBeNull();

    typeInto(input, 'sav');
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith(
      'sav',
      expect.objectContaining({ reason: 'input-change' }),
    );
    expect(itemTexts()).toEqual(['Save', 'Save as']);
    expect(document.querySelector('[data-testid=edit]')).toHaveAttribute('hidden');
    expect(document.querySelector('[data-testid=file]')).not.toHaveAttribute('hidden');
    expect(document.querySelector('[data-testid=clear]')).not.toBeNull();

    typeInto(input, 'redo');
    await settle();
    expect(itemTexts()).toEqual(['Redo ⇧⌘Z']);

    typeInto(input, 'zzz');
    await settle();
    expect(itemTexts()).toEqual([]);
    expect(document.querySelector('[data-testid=empty]')!.textContent).toContain(
      'No actions found.',
    );

    (document.querySelector('[data-testid=clear]') as HTMLElement).click();
    await settle();
    expect(input.value).toBe('');
    expect(itemTexts().length).toBe(5);
  });

  it('highlights items with the arrow keys via aria-activedescendant', async () => {
    const { container } = mount(() => <FilterMenu />);
    container.querySelector('button')!.click();
    await settle();
    const input = document.querySelector('[data-testid=popup] input') as HTMLInputElement;
    input.focus();
    typeInto(input, 'save');
    await settle();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    const activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).not.toBeNull();
    expect(document.getElementById(activeId!)!.textContent).toBe('Save');
  });
});
