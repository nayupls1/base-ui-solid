import { flush, createSignal } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Dialog } from '../src/dialog';
import { AlertDialog } from '../src/alert-dialog';

function mount(fn: () => any) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = render(fn, container);
  return { container, dispose };
}
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
async function settle() {
  flush();
  await tick();
  flush();
}

describe('Dialog', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
  });

  it('opens, labels the popup and closes with Close', async () => {
    const onOpenChange = vi.fn();
    const { container } = mount(() => (
      <Dialog.Root onOpenChange={onOpenChange}>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop data-testid="backdrop" />
          <Dialog.Popup>
            <Dialog.Title>Title</Dialog.Title>
            <Dialog.Description>Desc</Dialog.Description>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    const trigger = container.querySelector('button')!;
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[role=dialog]')).toBeNull();

    trigger.click();
    await settle();
    expect(onOpenChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ reason: 'trigger-press' }),
    );
    const popup = document.querySelector('[role=dialog]') as HTMLElement;
    expect(popup).not.toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBe(popup.id);
    expect(popup.getAttribute('aria-labelledby')).toBe(document.querySelector('h2')!.id);
    expect(popup.getAttribute('aria-describedby')).toBe(document.querySelector('p')!.id);
    expect(popup).toHaveAttribute('data-open');
    expect(document.querySelector('[data-testid=backdrop]')).toHaveAttribute('role', 'presentation');
    // Modal dialogs render an internal backdrop.
    expect(document.querySelector('[data-base-ui-inert]')).not.toBeNull();

    (popup.querySelector('button') as HTMLElement).click();
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: 'close-press' }),
    );
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape', async () => {
    mount(() => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup>
            <button>inside</button>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();
    const popup = document.querySelector('[role=dialog]') as HTMLElement;
    expect(popup).not.toBeNull();
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });

  it('supports controlled mode', async () => {
    const [open, setOpen] = createSignal(false);
    mount(() => (
      <Dialog.Root open={open()} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Popup>Content</Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();
    expect(document.querySelector('[role=dialog]')).toBeNull();
    setOpen(true);
    await settle();
    expect(document.querySelector('[role=dialog]')).not.toBeNull();
    setOpen(false);
    await settle();
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });

  it('marks nested dialogs', async () => {
    mount(() => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup data-testid="parent">
            <Dialog.Root defaultOpen>
              <Dialog.Portal>
                <Dialog.Popup data-testid="child">Child</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();
    await settle();
    const parent = document.querySelector('[data-testid=parent]') as HTMLElement;
    const child = document.querySelector('[data-testid=child]') as HTMLElement;
    expect(child).toHaveAttribute('data-nested');
    expect(parent).toHaveAttribute('data-nested-dialog-open');
    expect(parent.style.getPropertyValue('--nested-dialogs')).toBe('1');
  });

  it('opens from a detached trigger with a handle and payload', async () => {
    const handle = Dialog.createHandle<{ text: string }>();
    mount(() => (
      <>
        <Dialog.Trigger handle={handle} payload={{ text: 'one' }}>
          One
        </Dialog.Trigger>
        <Dialog.Root handle={handle}>
          {({ payload }: { payload: { text: string } | undefined }) => (
            <Dialog.Portal>
              <Dialog.Popup>{payload?.text}</Dialog.Popup>
            </Dialog.Portal>
          )}
        </Dialog.Root>
      </>
    ));
    await settle();
    (document.querySelector('button') as HTMLElement).click();
    await settle();
    expect(document.querySelector('[role=dialog]')?.textContent).toBe('one');
    expect(handle.isOpen).toBe(true);
    handle.close();
    await settle();
    await settle();
    await settle();
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});

describe('AlertDialog', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders role=alertdialog and ignores outside presses', async () => {
    mount(() => (
      <AlertDialog.Root defaultOpen>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop data-testid="backdrop" />
          <AlertDialog.Popup>
            <AlertDialog.Title>Discard?</AlertDialog.Title>
            <AlertDialog.Close>Cancel</AlertDialog.Close>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ));
    await settle();
    const popup = document.querySelector('[role=alertdialog]') as HTMLElement;
    expect(popup).not.toBeNull();
    const backdrop = document.querySelector('[data-testid=backdrop]') as HTMLElement;
    backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(document.querySelector('[role=alertdialog]')).not.toBeNull();
  });
});
