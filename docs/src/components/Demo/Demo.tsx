import { createMemo, createSignal, flush, Show, untrack } from 'solid-js';
import { Collapsible } from '@base-ui-solid/solid/collapsible';
import { ScrollArea } from '@base-ui-solid/solid/scroll-area';
import { CopyIcon } from '../../icons/CopyIcon';
import { CheckIcon } from '../../icons/CheckIcon';
import { GhostButton } from '../GhostButton';
import { copyText } from '../CodeBlock';
import { DemoVariantSelector } from './DemoVariantSelector';
import { DemoFileSelector } from './DemoFileSelector';
import { DemoCodeBlock } from './DemoCodeBlock';
import { DemoPlayground } from './DemoPlayground';
import type { DemoProps } from './types';
import './Demo.css';
import './Demo.solid.css';

const VARIANT_STORAGE_KEY = 'base-ui-solid:demo-variant';

function readStoredVariant() {
  try {
    return localStorage.getItem(VARIANT_STORAGE_KEY);
  } catch {
    return null;
  }
}

// The preferred styling method is shared by every demo on the site, like upstream.
const [preferredVariant, setPreferredVariant] = createSignal<string | null>(readStoredVariant());

function storeVariant(value: string) {
  setPreferredVariant(value);
  try {
    localStorage.setItem(VARIANT_STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

export function Demo(props: DemoProps) {
  let collapsibleTrigger: HTMLSpanElement | undefined;

  const variantNames = createMemo(() => Object.keys(props.variants));
  const selectedVariant = createMemo(() => {
    const preferred = preferredVariant();
    const names = variantNames();
    return preferred && names.includes(preferred) ? preferred : names[0];
  });
  const variant = createMemo(() => props.variants[selectedVariant()]);

  const [expanded, setExpanded] = createSignal(false);
  const [selectedFileName, setSelectedFileName] = createSignal<string | undefined>(undefined);
  const [copied, setCopied] = createSignal(false);
  let copyTimeout = 0;

  const selectedFile = createMemo(() => {
    const files = variant().files;
    const name = selectedFileName();
    return files.find((file) => file.name === name) ?? files[0];
  });
  const selectedFileLines = createMemo(() => selectedFile().code.split('\n').length);

  const demoComponent = createMemo(() => {
    const Component = variant().component;
    return untrack(() => <Component />);
  });

  const onOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && collapsibleTrigger != null) {
      const buttonVisualEl = collapsibleTrigger;
      const rectTopBeforeClose = buttonVisualEl.getBoundingClientRect().top;
      setExpanded(nextOpen);
      flush();
      const rectTopAfterClose = buttonVisualEl.getBoundingClientRect().top;
      const delta = rectTopAfterClose - rectTopBeforeClose;
      // Don't scroll if the collapse button is still in the viewport after closing.
      if (rectTopAfterClose < 0) {
        window.scrollBy({ top: delta, behavior: 'instant' });
      }
      return;
    }
    setExpanded(nextOpen);
  };

  const onCopy = async () => {
    await copyText(selectedFile().code);
    window.clearTimeout(copyTimeout);
    setCopied(true);
    copyTimeout = window.setTimeout(() => setCopied(false), 2000);
  };

  const toolbarActions = () => (
    <Show when={variantNames().length > 1}>
      <DemoVariantSelector
        onVariantChange={() => setExpanded(true)}
        variants={variantNames()}
        selectedVariant={selectedVariant()}
        selectVariant={(value) => {
          setSelectedFileName(undefined);
          storeVariant(value);
        }}
      />
    </Show>
  );

  return (
    <div class={['DemoRoot', props.class]}>
      <Show when={props.slug}>
        <span id={props.slug} class="bui-scroll-mt-4" />
      </Show>
      <DemoPlayground variant={selectedVariant()}>{demoComponent()}</DemoPlayground>
      <Collapsible.Root class="DemoCollapsibleRoot" open={expanded()} onOpenChange={onOpenChange}>
        <figure aria-label="Component demo code">
          <div class="DemoToolbar">
            <ScrollArea.Root class="DemoToolbarScrollAreaRoot">
              <ScrollArea.Viewport class="DemoToolbarViewport">
                <DemoFileSelector
                  files={variant().files}
                  selectedFileName={selectedFile().name}
                  selectFileName={setSelectedFileName}
                  onTabChange={() => setExpanded(true)}
                />
                <div class="DemoToolbarActions DemoToolbarActionsMobile">{toolbarActions()}</div>
              </ScrollArea.Viewport>
            </ScrollArea.Root>
            <div class="DemoToolbarActions DemoToolbarActionsDesktop">{toolbarActions()}</div>
          </div>
          <DemoCodeBlock
            selectedFileHtml={selectedFile().html}
            selectedFileLines={selectedFileLines()}
            collapsibleOpen={expanded()}
            collapsibleTriggerRef={(el) => {
              collapsibleTrigger = el;
            }}
            copyButton={
              <GhostButton
                layout="icon"
                aria-label="Copy code"
                onClick={onCopy}
                class="DemoCodeBlockCopyButton"
              >
                <Show when={copied()} fallback={<CopyIcon />}>
                  <CheckIcon />
                </Show>
              </GhostButton>
            }
          />
        </figure>
      </Collapsible.Root>
    </div>
  );
}

