import type { JSX } from '@solidjs/web';
import './DescriptionList.css';

export function Root(props: JSX.HTMLAttributes<HTMLDListElement>) {
  return <dl {...props} class={['DescriptionList', props.class]} />;
}

export function Term(props: JSX.HTMLAttributes<HTMLElement> & { separator?: boolean }) {
  return (
    <dt {...props} class={['DescriptionTerm', { separator: props.separator }, props.class]}>
      <div class="DescriptionListInner">{props.children}</div>
    </dt>
  );
}

export function Details(props: JSX.HTMLAttributes<HTMLElement>) {
  return (
    <dd {...props} class={['DescriptionListDetails', props.class]}>
      <div class="DescriptionListInner">{props.children}</div>
    </dd>
  );
}

export function Item(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} class={['DescriptionListItem', props.class]} />;
}
