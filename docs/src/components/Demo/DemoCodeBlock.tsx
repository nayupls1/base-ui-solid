import { omit, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Collapsible } from 'base-ui-solidjs/collapsible';
import * as ScrollArea from '../ScrollArea';
import { selectAllOnModA } from '../CodeBlock';

interface DemoCodeBlockProps {
  selectedFileHtml: string;
  selectedFileLines: number;
  collapsibleOpen: boolean;
  /** How many lines should the code block have to get collapsed instead of rendering fully */
  collapsibleLinesThreshold?: number;
  collapsibleTriggerRef: (el: HTMLSpanElement) => void;
  copyButton: JSX.Element;
}

function Root(props: ScrollArea.Root.Props & Record<string, unknown>) {
  return (
    <ScrollArea.Root {...props} class="DemoCodeBlockRoot" tabindex={-1} onKeyDown={selectAllOnModA} />
  );
}

function Source(props: { html: string }) {
  return (
    <div class="DemoSourceBrowser">
      <pre>
        <code innerHTML={props.html} />
      </pre>
    </div>
  );
}

export function DemoCodeBlock(props: DemoCodeBlockProps) {
  return (
    <Show
      when={props.selectedFileLines >= (props.collapsibleLinesThreshold ?? 8)}
      fallback={
        <Root>
          <ScrollArea.Viewport>
            <Source html={props.selectedFileHtml} />
          </ScrollArea.Viewport>
          <ScrollArea.Corner />
          <ScrollArea.Scrollbar orientation="vertical" />
          <ScrollArea.Scrollbar orientation="horizontal" />
          {props.copyButton}
        </Root>
      }
    >
      <div class="DemoCodeBlockCollapsible">
        <Root data-closed={props.collapsibleOpen ? undefined : ''}>
          <Collapsible.Panel
            keepMounted
            hidden={false}
            render={(panelProps: any) => {
              const rest = omit(panelProps, 'hidden');
              return (
                <ScrollArea.Viewport
                  {...rest}
                  aria-hidden={props.collapsibleOpen ? undefined : 'true'}
                  data-closed={props.collapsibleOpen ? undefined : ''}
                  class="DemoCodeBlockViewport"
                  tabindex={props.collapsibleOpen ? 0 : undefined}
                />
              );
            }}
          >
            <Source html={props.selectedFileHtml} />
          </Collapsible.Panel>
          <Show when={props.collapsibleOpen}>
            <ScrollArea.Corner />
            <ScrollArea.Scrollbar orientation="vertical" />
            <ScrollArea.Scrollbar orientation="horizontal" />
          </Show>
          {props.copyButton}
          <Collapsible.Trigger
            class="DemoCollapseButton"
            data-sticky={props.collapsibleOpen ? '' : undefined}
          >
            <span ref={props.collapsibleTriggerRef} class="DemoCollapseButtonVisual">
              {props.collapsibleOpen ? 'Hide code' : 'Show code'}
            </span>
          </Collapsible.Trigger>
        </Root>
      </div>
    </Show>
  );
}
