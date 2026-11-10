import { omit, onCleanup, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { observeScrollableInner } from '../utils/observeScrollableInner';
import './Accordion.css';

export function Root(props: JSX.HTMLAttributes<HTMLElement>) {
  return <section {...props} class={['AccordionRoot', props.class]} />;
}

export function Trigger(props: JSX.HTMLAttributes<HTMLElement>) {
  return (
    <summary
      {...props}
      class={['AccordionTrigger', props.class]}
      onClick={(event) => {
        const selection = window.getSelection();
        if (!selection?.isCollapsed) {
          event.preventDefault();
        }
      }}
      onMouseDown={(event) => {
        if (!event.defaultPrevented && event.detail > 1) {
          event.preventDefault();
        }
      }}
    />
  );
}

export function Item(props: JSX.DetailsHtmlAttributes<HTMLDetailsElement>) {
  let details: HTMLDetailsElement | undefined;

  // In Chrome, the <details> opens automatically when the hash part of a URL matches the `id`
  // on <summary> but needs to be manually handled for Safari and Firefox.
  const checkHash = () => {
    const triggerId = details?.querySelector('summary')?.getAttribute('id');
    const hash = window.location.hash.slice(1);
    if (details && triggerId && hash && triggerId === hash) {
      details.open = true;
    }
  };

  onSettled(() => {
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  });

  return <details {...props} ref={details} class={['AccordionItem', props.class]} />;
}

export function Panel(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} class={['AccordionPanel', props.class]} />;
}

export function Content(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} class={['AccordionContent', props.class]} />;
}

/* Scroll container with an overscroll overlay graphic for overflowing content inside the trigger */
export function Scrollable(
  props: JSX.HTMLAttributes<HTMLSpanElement> & { gradientColor?: string },
) {
  const rest = omit(props, 'children', 'class', 'gradientColor');
  let cleanup: (() => void) | undefined;
  onCleanup(() => cleanup?.());
  return (
    <span
      ref={(el) => {
        queueMicrotask(() => {
          cleanup = observeScrollableInner(el);
        });
      }}
      class={['AccordionScrollable', props.class]}
      style={{ '--scrollable-gradient-color': props.gradientColor ?? 'var(--color-content)' }}
      {...rest}
    >
      <span class="AccordionScrollableInner">{props.children}</span>
    </span>
  );
}

/* Fake <tr> */
export function HeaderRow(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} aria-hidden="true" class={['AccordionHeaderRow', props.class]} />;
}

/* Fake <th scope="col"> */
export function HeaderCell(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const rest = omit(props, 'children', 'class');
  return (
    <div {...rest} class={['AccordionHeaderCell', props.class]}>
      <span class="AccordionHeaderCellInner">{props.children}</span>
    </div>
  );
}
