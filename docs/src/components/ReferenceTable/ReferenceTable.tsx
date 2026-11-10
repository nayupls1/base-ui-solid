import { createMemo, createUniqueId, For, Show } from 'solid-js';
import { visuallyHidden } from 'base-ui-solidjs-utils/visuallyHidden';
import * as Accordion from '../Accordion';
import * as Table from '../Table';
import * as DescriptionList from '../DescriptionList';
import { TableCode } from '../TableCode';
import { Link } from '../Link';
import * as CodeBlock from '../CodeBlock';
import type { ReferenceAttribute, ReferencePart, ReferenceProp } from './types';
import './ReferenceTable.css';

function ChevronIcon(props: { class: string }) {
  return (
    <svg class={props.class} width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 3.5L5 7.5L9 3.5" stroke="currentColor" />
    </svg>
  );
}

/** A short label for long types in the collapsed row, like upstream's `shortType`. */
function shortType(type: string) {
  const trimmed = type.trim();
  if (trimmed.length <= 32) {
    return null;
  }
  if (/^\(?\(.*\)\s*=>/.test(trimmed)) {
    return 'function';
  }
  if (trimmed.includes(' | ')) {
    return 'Union';
  }
  return null;
}

function Html(props: { html: string; class?: string }) {
  return <div class={props.class} innerHTML={props.html} />;
}

function HighlightedCode(props: { html: string }) {
  return <TableCode innerHTML={props.html} />;
}

interface ReferenceAccordionProps {
  data: ReferenceProp[];
  name: string;
  nameLabel?: string;
  caption?: string;
  class?: string;
}

export function ReferenceAccordion(props: ReferenceAccordionProps) {
  const captionId = createUniqueId();
  const nameLabel = () => props.nameLabel ?? 'Prop';

  return (
    <Accordion.Root
      aria-describedby={captionId}
      class={['ReferenceAccordionRoot', props.class]}
      // Lets CSS compute the minimum closed height for `contain-intrinsic-height`.
      style={{ '--rows': String(props.data.length) }}
    >
      <span id={captionId} style={visuallyHidden} aria-hidden="true">
        {props.caption ?? 'Component props table'}
      </span>
      <Accordion.HeaderRow class="ReferenceHeaderRow">
        <Accordion.HeaderCell>{nameLabel()}</Accordion.HeaderCell>
        <Accordion.HeaderCell class="ReferenceHeaderTypeCell">Type</Accordion.HeaderCell>
        <Accordion.HeaderCell class="ReferenceHeaderDefaultCell">Default</Accordion.HeaderCell>
        <Accordion.HeaderCell class="ReferenceHeaderIconCell" />
      </Accordion.HeaderRow>
      <For each={props.data}>
        {(prop) => {
          const id = `${props.name.replace('.', '')}-${prop.name}`;
          const short = shortType(prop.type);
          return (
            <Accordion.Item>
              <Accordion.Trigger
                id={id}
                aria-label={`${nameLabel()}: ${prop.name}, type: ${short ?? prop.type} ${
                  prop.default != null ? `(default: ${prop.default})` : ''
                }`}
                class="ReferenceTrigger"
              >
                <Accordion.Scrollable class="ReferenceNameCell">
                  <TableCode class="bui-ws-nw" style={{ color: 'var(--color-navy)' }}>
                    {prop.name}
                  </TableCode>
                </Accordion.Scrollable>
                <Show when={prop.type}>
                  <Accordion.Scrollable class="ReferenceTypeCell">
                    <Show when={short} fallback={<HighlightedCode html={prop.typeHtml} />}>
                      <TableCode>
                        <span class="pl-en">{short}</span>
                      </TableCode>
                    </Show>
                  </Accordion.Scrollable>
                </Show>
                <Accordion.Scrollable class="ReferenceDefaultCell">
                  <Show
                    when={prop.default != null}
                    fallback={
                      <TableCode style={{ color: 'var(--color-docs-infra-syntax-nullish)' }}>
                        —
                      </TableCode>
                    }
                  >
                    <HighlightedCode html={prop.defaultHtml} />
                  </Show>
                </Accordion.Scrollable>
                <span class="ReferenceIconWrap">
                  <ChevronIcon class="AccordionIcon ReferenceIcon" />
                </span>
              </Accordion.Trigger>
              <Accordion.Panel>
                <Accordion.Content>
                  <DescriptionList.Root class="ReferenceContent" aria-label="Info">
                    <DescriptionList.Item>
                      <DescriptionList.Term>Name</DescriptionList.Term>
                      <DescriptionList.Details>
                        <Link href={`#${id}`}>
                          <TableCode style={{ color: 'var(--color-blue)' }}>{prop.name}</TableCode>
                        </Link>
                      </DescriptionList.Details>
                    </DescriptionList.Item>
                    <Show when={prop.description}>
                      <DescriptionList.Item>
                        <DescriptionList.Term separator>Description</DescriptionList.Term>
                        <DescriptionList.Details class="ReferenceDescription">
                          <Html html={prop.description} />
                        </DescriptionList.Details>
                      </DescriptionList.Item>
                    </Show>
                    <DescriptionList.Item>
                      <DescriptionList.Term separator>Type</DescriptionList.Term>
                      <DescriptionList.Details>
                        <CodeBlock.Root>
                          <CodeBlock.PreInline>
                            <code innerHTML={`<span class="frame">${prop.typeHtml}</span>`} />
                          </CodeBlock.PreInline>
                        </CodeBlock.Root>
                      </DescriptionList.Details>
                    </DescriptionList.Item>
                    <Show when={prop.default != null}>
                      <DescriptionList.Item>
                        <DescriptionList.Term separator>Default</DescriptionList.Term>
                        <DescriptionList.Details>
                          <HighlightedCode html={prop.defaultHtml} />
                        </DescriptionList.Details>
                      </DescriptionList.Item>
                    </Show>
                    <Show when={prop.example}>
                      <DescriptionList.Item>
                        <DescriptionList.Term separator>Example</DescriptionList.Term>
                        <DescriptionList.Details class="ReferenceExampleReset">
                          <Html html={prop.example} />
                        </DescriptionList.Details>
                      </DescriptionList.Item>
                    </Show>
                  </DescriptionList.Root>
                </Accordion.Content>
              </Accordion.Panel>
            </Accordion.Item>
          );
        }}
      </For>
    </Accordion.Root>
  );
}

interface NameDescriptionTableProps {
  data: ReferenceAttribute[];
  name: string;
  label: string;
  class?: string;
}

/** Shared layout of the data attributes and CSS variables tables. */
function NameDescriptionTable(props: NameDescriptionTableProps) {
  const rowsStyle = () => ({ '--rows': String(props.data.length) });
  return (
    <>
      <Accordion.Root
        class={['ReferenceAccordionRoot', 'bp0:bui-d-n', props.class]}
        style={rowsStyle()}
      >
        <Accordion.HeaderRow>
          <Accordion.HeaderCell>{props.label}</Accordion.HeaderCell>
        </Accordion.HeaderRow>
        <For each={props.data}>
          {(item) => (
            <Accordion.Item>
              <Accordion.Trigger>
                <TableCode style={{ color: 'var(--color-navy)' }}>{item.name}</TableCode>
                <ChevronIcon class="AccordionIcon bui-ml-a bui-mr-1" />
              </Accordion.Trigger>
              <Accordion.Panel>
                <Accordion.Content class="ReferenceCompactPanel">
                  <span innerHTML={item.description} />
                </Accordion.Content>
              </Accordion.Panel>
            </Accordion.Item>
          )}
        </For>
      </Accordion.Root>
      <Table.Root
        class={['ReferenceTableRoot', 'bui-d-n', 'bp0:bui-d-b', props.class]}
        style={rowsStyle()}
      >
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader class="ReferenceWideNameColumn">{props.label}</Table.ColumnHeader>
            <Table.ColumnHeader class="ReferenceWideDescriptionColumn">Description</Table.ColumnHeader>
            <Table.ColumnHeader class="bui-w-10" aria-hidden="true">
              <span class="bui-v-h">-</span>
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <For each={props.data}>
            {(item) => (
              <Table.Row>
                <Table.RowHeader>
                  <TableCode class="bui-ws-nw" style={{ color: 'var(--color-navy)' }}>
                    {item.name}
                  </TableCode>
                </Table.RowHeader>
                <Table.Cell colspan={2}>
                  <span innerHTML={item.description} />
                </Table.Cell>
              </Table.Row>
            )}
          </For>
        </Table.Body>
      </Table.Root>
    </>
  );
}

export function AttributesReferenceTable(props: Omit<NameDescriptionTableProps, 'label'>) {
  return <NameDescriptionTable {...props} label="Attribute" />;
}

export function CssVariablesReferenceTable(props: Omit<NameDescriptionTableProps, 'label'>) {
  return <NameDescriptionTable {...props} label="CSS Variable" />;
}

function SectionHeading(props: { children: string }) {
  return <h3 class="ReferenceSectionHeading">{props.children}</h3>;
}

export function ReferenceTable(props: { data: ReferencePart; multiple?: boolean; hideDescription?: boolean }) {
  // Consecutive sections with the same label (such as several methods) share a heading.
  const sectionGroups = createMemo(() => {
    const groups: Array<{ label: string; html: string[] }> = [];
    for (const section of props.data.sections) {
      const last = groups[groups.length - 1];
      if (last && last.label === section.label) {
        last.html.push(section.html);
      } else {
        groups.push({ label: section.label, html: [section.html] });
      }
    }
    return groups;
  });

  return (
    <>
      <Show when={props.multiple !== false && !props.hideDescription && props.data.description}>
        <Html html={props.data.description} class="ReferenceDescriptionText" />
      </Show>
      <Show when={props.data.props?.length}>
        <ReferenceAccordion name={props.data.name} data={props.data.props!} class="ReferenceBlockSpaced" />
      </Show>
      <Show when={props.data.dataAttributes?.length}>
        <AttributesReferenceTable
          name={props.data.name}
          data={props.data.dataAttributes!}
          class="ReferenceBlockSpaced"
        />
      </Show>
      <Show when={props.data.cssVariables?.length}>
        <CssVariablesReferenceTable
          name={props.data.name}
          data={props.data.cssVariables!}
          class="ReferenceBlockSpaced"
        />
      </Show>
      <For each={sectionGroups()}>
        {(group) => (
          <div class="ReferenceBlock">
            <SectionHeading>{group.label.replace(/^Return Value$/, 'Return value')}</SectionHeading>
            <For each={group.html}>{(html) => <Html html={html} class="ReferenceSection" />}</For>
          </div>
        )}
      </For>
    </>
  );
}
