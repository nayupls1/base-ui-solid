import type { JSX } from '@solidjs/web';

/**
 * The project mark (the same icon as `assets/icon.svg`). Base UI's own logo is MUI's mark, so the
 * port uses its own.
 */
export function Logo(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 64 64" {...props}>
      <rect width="64" height="64" rx="14" fill="#0284c7" />
      <text
        x="32"
        y="32"
        dy="0.35em"
        text-anchor="middle"
        font-family="ui-sans-serif, system-ui, -apple-system, sans-serif"
        font-size="26"
        font-weight="600"
        fill="#ffffff"
      >
        BU
      </text>
    </svg>
  );
}
