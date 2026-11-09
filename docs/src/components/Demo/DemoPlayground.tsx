import { Errored } from 'solid-js';
import type { JSX } from '@solidjs/web';

function kebabCase(value: string | undefined) {
  return value
    ?.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function DemoErrorFallback(props: { error: unknown; reset: () => void }) {
  return (
    <div role="alert">
      <p>There was an error while rendering the demo.</p>
      <pre>{(props.error instanceof Error ? props.error.message : null) ?? 'Unknown error'}</pre>
      <button type="button" onClick={() => props.reset()}>
        Try again
      </button>
    </div>
  );
}

export function DemoPlayground(props: { children: JSX.Element; variant?: string }) {
  return (
    <Errored fallback={(error, reset) => <DemoErrorFallback error={error} reset={reset} />}>
      <div class="DemoPlayground">
        <figure
          aria-label="Component demo"
          data-demo={kebabCase(props.variant)}
          class="DemoPlaygroundInner"
        >
          {props.children}
        </figure>
      </div>
    </Errored>
  );
}
