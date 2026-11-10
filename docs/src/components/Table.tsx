import type { JSX } from '@solidjs/web';
import './Table.css';

export function Root(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} class={['TableRoot', props.class]}>
      <table class="TableRootTable">{props.children}</table>
    </div>
  );
}

export function Head(props: JSX.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} class={['TableHead', props.class]} />;
}

export function Body(props: JSX.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} class={['TableBody', props.class]} />;
}

export function Row(props: JSX.HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} class={['TableRow', props.class]} />;
}

export function ColumnHeader(props: JSX.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" {...props} class={['TableColumnHeader', props.class]}>
      <div class="TableCellInner">{props.children}</div>
    </th>
  );
}

export function RowHeader(props: JSX.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="row" {...props} class={['TableCell', props.class]}>
      <div class="TableCellInner">{props.children}</div>
    </th>
  );
}

export function Cell(props: JSX.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...props} class={['TableCell', props.class]}>
      <div class="TableCellInner">{props.children}</div>
    </td>
  );
}
