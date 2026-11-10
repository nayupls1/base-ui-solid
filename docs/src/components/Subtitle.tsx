import type { JSX } from '@solidjs/web';
import './Subtitle/Subtitle.css';

export function Subtitle(props: JSX.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div class={['Subtitle', props.class]}>
      <p {...props} class={undefined} />
    </div>
  );
}
