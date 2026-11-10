import { omit, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Dynamic } from '@solidjs/web';
import * as CodeBlock from './components/CodeBlock';
import * as Table from './components/Table';
import * as QuickNav from './components/QuickNav/QuickNav';
import { Code } from './components/Code';
import { Link } from './components/Link';
import { HeadingLink } from './components/HeadingLink';
import { Subtitle } from './components/Subtitle';
import { Kbd } from './components/Kbd';
import { setPageMeta } from './utils/pageMeta';
import './css/mdx-components.css';

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

function Heading(
  props: JSX.HTMLAttributes<HTMLHeadingElement> & {
    as: HeadingLevel;
    link?: boolean;
    'data-heading-badge'?: string;
  },
) {
  const rest = omit(props, 'as', 'class', 'children', 'id', 'link', 'data-heading-badge');
  const badge = () => (
    <Show when={props['data-heading-badge']}>
      <span class="MdHeadingBadge">{props['data-heading-badge']}</span>
    </Show>
  );
  return (
    <Dynamic component={props.as} class={props.class} id={props.id} {...rest}>
      <Show
        when={props.link}
        fallback={
          <>
            {props.children}
            {badge()}
          </>
        }
      >
        <HeadingLink href={`#${props.id}`}>
          {props.children}
          {badge()}
        </HeadingLink>
      </Show>
    </Dynamic>
  );
}

function Pre(props: JSX.HTMLAttributes<HTMLPreElement> & { 'data-title'?: string }) {
  const rest = omit(props, 'data-title', 'tabindex' as any);
  return (
    <CodeBlock.Root class="MdFigure">
      <Show when={props['data-title']}>
        <CodeBlock.Panel>{props['data-title']}</CodeBlock.Panel>
      </Show>
      <CodeBlock.Content>
        <pre {...rest} class="CodeBlockPreInline CodeBlockPre" />
      </CodeBlock.Content>
    </CodeBlock.Root>
  );
}

function intrinsic(tag: string) {
  return (props: any) => <Dynamic component={tag} {...props} />;
}

// MDX falls back to tag name strings for elements without a component, which Solid can't render
// through member expressions (`<_components.strong>`). Map every remaining markdown element.
const intrinsicElements = Object.fromEntries(
  ['strong', 'del', 'blockquote', 'img', 'br', 'input', 'sup', 'sub', 'section', 'span', 'div', 'b', 'i', 'small', 'details', 'summary'].map(
    (tag) => [tag, intrinsic(tag)],
  ),
);

// Maintain spacing between MDX components here
export const mdxComponents: Record<string, any> = {
  ...intrinsicElements,
  a: Link,
  em: (props: any) => <em class="MdEm" {...props} />,
  code: (props: any) => <Code {...props} class={['MdCode', props.class]} />,
  // Do not wrap heading tags in divs, that confuses Safari Reader
  h1: (props: any) => <Heading as="h1" class="MdH1" {...props} />,
  h2: (props: any) => <Heading as="h2" class="MdH2" link {...props} />,
  h3: (props: any) => <Heading as="h3" class="MdH3" link {...props} />,
  h4: (props: any) => <Heading as="h4" class="MdH4" {...props} />,
  h5: (props: any) => <Heading as="h5" class="MdH5" {...props} />,
  h6: (props: any) => <Heading as="h6" class="MdH6" {...props} />,
  p: (props: any) => <p class="MdP" {...props} />,
  li: (props: any) => <li class="MdListItem" {...props} />,
  ul: (props: any) => <ul class="MdUl" {...props} />,
  ol: (props: any) => <ol class="MdOl" {...props} />,
  kbd: Kbd,
  figure: (props: any) => <figure class="MdFigure" {...props} />,
  hr: (props: any) => <hr class="MdHr" {...props} />,
  pre: Pre,
  table: (props: any) => <Table.Root class="MdTable" {...props} />,
  thead: Table.Head,
  tbody: Table.Body,
  tr: Table.Row,
  th: (props: any) =>
    props.scope === 'row' ? <Table.RowHeader {...props} /> : <Table.ColumnHeader {...props} />,
  td: Table.Cell,
  // Custom components
  QuickNav,
  Subtitle: (props: any) => {
    setPageMeta({ subtitle: typeof props.children === 'string' ? props.children : undefined });
    return <Subtitle {...props} />;
  },
  Meta: (props: { name?: string; content?: string }) => {
    if (props.name === 'description' && props.content) {
      setPageMeta({ description: props.content });
    }
    return null;
  },
};
