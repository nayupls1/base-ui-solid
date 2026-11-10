import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import './GhostButton.css';

interface GhostButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  layout?: 'text' | 'icon';
}

export function GhostButton(props: GhostButtonProps) {
  const rest = omit(props, 'class', 'layout');
  return (
    <button
      data-layout={props.layout ?? 'text'}
      type="button"
      class={['GhostButton', props.class]}
      {...rest}
    />
  );
}
