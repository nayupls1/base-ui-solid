import { createContext, createSignal, omit, Show, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createUniqueId } from 'solid-js';
import * as ScrollArea from '../ScrollArea';
import { CopyIcon } from '../../icons/CopyIcon';
import { CheckIcon } from '../../icons/CheckIcon';
import { GhostButton } from '../GhostButton';
import './CodeBlock.css';

interface CodeBlockContextValue {
  codeId: string | undefined;
  titleId: string | undefined;
  showCopy: boolean;
}

const CodeBlockContext = createContext<CodeBlockContextValue>({
  codeId: undefined,
  titleId: undefined,
  showCopy: true,
});

interface CodeBlockRootProps extends JSX.HTMLAttributes<HTMLElement> {
  showCopy?: boolean;
}

export function Root(props: CodeBlockRootProps) {
  const rest = omit(props, 'showCopy', 'class');
  const titleId = createUniqueId();
  const codeId = createUniqueId();
  const context: CodeBlockContextValue = {
    codeId,
    titleId,
    get showCopy() {
      return props.showCopy ?? true;
    },
  };
  return (
    <CodeBlockContext value={context}>
      <figure aria-labelledby={titleId} {...rest} class={['CodeBlockRoot', props.class]} />
    </CodeBlockContext>
  );
}

interface CodeBlockPanelProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** When provided, renders as a separate sr-only label instead of wrapping children. */
  title?: string;
}

export function copyText(text: string) {
  return navigator.clipboard?.writeText(text);
}

export function Panel(props: CodeBlockPanelProps) {
  const ctx = useContext(CodeBlockContext);
  const rest = omit(props, 'class', 'title', 'children');
  const [copied, setCopied] = createSignal(false);
  let timeout = 0;

  return (
    <div class={['CodeBlockPanel', props.class]} {...rest}>
      <Show
        when={props.title != null}
        fallback={
          <div id={ctx.titleId} class="CodeBlockPanelTitle">
            {props.children}
          </div>
        }
      >
        <span id={ctx.titleId} class="bui-sr-only">
          {props.title}
        </span>
        {props.children}
      </Show>
      <Show when={ctx.showCopy}>
        <GhostButton
          aria-label="Copy code"
          layout="icon"
          onClick={async () => {
            const codeRoot = ctx.codeId ? document.getElementById(ctx.codeId) : null;
            const code = codeRoot?.querySelector('pre code')?.textContent ?? codeRoot?.textContent;
            if (code) {
              await copyText(code);
              window.clearTimeout(timeout);
              setCopied(true);
              timeout = window.setTimeout(() => setCopied(false), 2000);
            }
          }}
        >
          <span class="CodeBlockCopyIcon">
            <Show when={copied()} fallback={<CopyIcon />}>
              <CheckIcon />
            </Show>
          </span>
        </GhostButton>
      </Show>
    </div>
  );
}

export function selectAllOnModA(event: KeyboardEvent) {
  if (event.defaultPrevented) {
    return;
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === 'a' &&
    !event.shiftKey &&
    !event.altKey
  ) {
    event.preventDefault();
    window.getSelection()?.selectAllChildren(event.currentTarget as Node);
  }
}

export function Content(props: ScrollArea.Root.Props & { id?: string }) {
  const ctx = useContext(CodeBlockContext);
  const rest = omit(props, 'class', 'children');
  return (
    <ScrollArea.Root
      tabindex={-1}
      class={['CodeBlockPreContainer', props.class as any]}
      {...rest}
      id={ctx.codeId}
      onKeyDown={selectAllOnModA}
    >
      <ScrollArea.Viewport class="CodeBlockViewport">{props.children}</ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="horizontal" />
    </ScrollArea.Root>
  );
}

export function PreInline(props: JSX.HTMLAttributes<HTMLPreElement>) {
  return (
    <Content>
      <pre {...props} class={['CodeBlockPreInline', props.class]} />
    </Content>
  );
}

export function Pre(props: JSX.HTMLAttributes<HTMLPreElement>) {
  return <PreInline {...props} class="CodeBlockPre" />;
}

/** Inline wrapper for short highlighted type signatures. */
export function TypeInline(props: JSX.HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} class={['Code TableCode', props.class]} />;
}

/** A highlighted code snippet rendered from precomputed HTML. */
export function Html(props: { html: string; language?: string }) {
  return (
    <Root>
      <PreInline>
        <code data-language={props.language} innerHTML={props.html} />
      </PreInline>
    </Root>
  );
}
