import { createSignal, flush } from 'solid-js';
import { render } from '@solidjs/web';
import { describe, it, expect, vi } from 'vitest';
import { Collapsible } from '../src/collapsible';

function mount(fn: () => any) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const dispose = render(fn, container);
  return { container, dispose };
}

const tick = () => new Promise((r) => setTimeout(r, 30));

describe('Collapsible', () => {
  it('toggles the panel', async () => {
    const onOpenChange = vi.fn();
    const { container } = mount(() => (
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    const trigger = container.querySelector('button')!;
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(container.textContent).not.toContain('Content');
    trigger.click();
    flush();
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('data-panel-open');
    const panel = container.querySelector('button + div') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.textContent).toBe('Content');
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
    await tick();
    trigger.click();
    flush();
    await tick();
    flush();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(container.textContent).not.toContain('Content');
  });

  it('keepMounted keeps hidden panel', async () => {
    const { container } = mount(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel keepMounted>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    const panel = container.querySelector('button + div')!;
    expect(panel).toHaveAttribute('hidden');
    expect(panel).toHaveAttribute('data-closed');
  });

  it('controlled', () => {
    const [open, setOpen] = createSignal(true);
    const { container } = mount(() => (
      <Collapsible.Root open={open()}>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    expect(container.textContent).toContain('Content');
    container.querySelector('button')!.click();
    flush();
    expect(container.textContent).toContain('Content');
    setOpen(false);
    flush();
    expect(container.querySelector('button')).toHaveAttribute('aria-expanded', 'false');
  });
});
