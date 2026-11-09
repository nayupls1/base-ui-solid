import type { JSX } from '@solidjs/web';
import { Code } from './Code';
import './TableCode.css';

/** An inline code component for use in type tables */
export function TableCode(props: JSX.HTMLAttributes<HTMLElement>) {
  return <Code {...props} class={['TableCode', props.class]} />;
}
