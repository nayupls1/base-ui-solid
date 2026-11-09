import { For, Show } from 'solid-js';
import { Tabs } from '@base-ui-solid/solid/tabs';
import type { DemoFile } from './types';

interface DemoFileSelectorProps {
  files: DemoFile[];
  selectedFileName: string | undefined;
  selectFileName: (fileName: string) => void;
  onTabChange?: () => void;
}

export function DemoFileSelector(props: DemoFileSelectorProps) {
  return (
    <Show when={props.files.length > 1}>
      <Tabs.Root
        class="DemoTabsRoot"
        value={props.selectedFileName}
        onValueChange={(value: string) => {
          props.selectFileName(value);
          props.onTabChange?.();
        }}
      >
        <Tabs.List class="DemoTabsList" aria-label="Files">
          <For each={props.files}>
            {(file) => (
              <Tabs.Tab class="DemoTab" value={file.name}>
                <span>{file.name}</span>
              </Tabs.Tab>
            )}
          </For>
        </Tabs.List>
      </Tabs.Root>
    </Show>
  );
}
