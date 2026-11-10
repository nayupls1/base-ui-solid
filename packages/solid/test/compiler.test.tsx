import { render } from '@solidjs/web';
import { it, expect } from 'vitest';

function C() {
  return <code>c</code>;
}

it('keeps components between text siblings in place', () => {
  const container = document.createElement('div');
  const dispose = render(
    () => (
      <p>
        a <C /> b
      </p>
    ),
    container,
  );
  expect(container.innerHTML.replace(/<!---->/g, '')).toBe('<p>a <code>c</code> b</p>');
  dispose();
});

it('fires delegated native event handlers', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let clicks = 0;
  const dispose = render(
    () => (
      <button type="button" onClick={() => (clicks += 1)}>
        x
      </button>
    ),
    container,
  );
  container.querySelector('button')!.click();
  expect(clicks).toBe(1);
  dispose();
  container.remove();
});
