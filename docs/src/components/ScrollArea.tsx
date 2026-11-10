import { ScrollArea } from 'base-ui-solidjs/scroll-area';
import './ScrollArea.css';

export const Root = ScrollArea.Root;

export function Viewport(props: ScrollArea.Viewport.Props) {
  return <ScrollArea.Viewport {...props} class={['ScrollAreaViewport', props.class as any]} />;
}

export function Scrollbar(props: ScrollArea.Scrollbar.Props) {
  return (
    <ScrollArea.Scrollbar {...props} class={['ScrollAreaScrollbar', props.class as any]}>
      <ScrollArea.Thumb class="ScrollAreaThumb" />
    </ScrollArea.Scrollbar>
  );
}

export function Corner(props: ScrollArea.Corner.Props) {
  return <ScrollArea.Corner {...props} class={['ScrollAreaCorner', props.class as any]} />;
}
