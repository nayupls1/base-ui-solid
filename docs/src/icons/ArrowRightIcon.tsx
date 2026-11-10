import type { JSX } from '@solidjs/web';

export function ArrowRightIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" {...props}>
      <path
        d="M1.5 6H11.25M11.25 6L7.25 2M11.25 6L7.25 10"
        stroke="currentColor"
        stroke-width="1.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
