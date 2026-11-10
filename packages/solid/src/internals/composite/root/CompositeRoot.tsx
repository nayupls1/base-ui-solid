import type { JSX } from '@solidjs/web';
import { EMPTY_ARRAY, EMPTY_OBJECT } from 'base-ui-solidjs-utils/empty';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { CompositeList } from '../list/CompositeList';
import type { CompositeMetadata } from '../list/CompositeList';
import { useCompositeRoot } from './useCompositeRoot';
import { CompositeRootContext } from './CompositeRootContext';
import { useRenderElement, type PropsInput, type RefInput } from '../../useRenderElement';
import type { BaseUIComponentProps, BaseUIEvent } from '../../types';
import type { ModifierKey } from '../composite';
import type { CompositeGridNavigator } from './gridNavigation';
import { useDirection } from '../../direction-context/DirectionContext';
import type { StateAttributesMapping } from '../../getStateAttributesProps';
import { omit, untrack } from 'solid-js';

const COMPOSITE_ROOT_KEYS = [
  'render',
  'class',
  'style',
  'refs',
  'props',
  'state',
  'stateAttributesMapping',
  'highlightedIndex',
  'onHighlightedIndexChange',
  'orientation',
  'grid',
  'loopFocus',
  'onLoop',
  'enableHomeAndEndKeys',
  'onMapChange',
  'stopEventPropagation',
  'rootRef',
  'disabledIndices',
  'modifierKeys',
  'highlightItemOnHover',
  'tag',
  'children',
  'ref',
] as const;

/**
 * @internal
 */
export function CompositeRoot<Metadata extends {}, State extends Record<string, any>>(
  componentProps: CompositeRoot.Props<Metadata, State>,
) {
  const elementProps = omit(componentProps, ...COMPOSITE_ROOT_KEYS);
  const direction = useDirection();

  const composite = useCompositeRoot({
    get grid() {
      return componentProps.grid;
    },
    get loopFocus() {
      return componentProps.loopFocus;
    },
    get onLoop() {
      return componentProps.onLoop;
    },
    get orientation() {
      return componentProps.orientation;
    },
    get highlightedIndex() {
      return componentProps.highlightedIndex;
    },
    get onHighlightedIndexChange() {
      return componentProps.onHighlightedIndexChange;
    },
    get rootRef() {
      return componentProps.rootRef;
    },
    get stopEventPropagation() {
      return componentProps.stopEventPropagation ?? true;
    },
    get enableHomeAndEndKeys() {
      return componentProps.enableHomeAndEndKeys;
    },
    get direction() {
      return direction();
    },
    get disabledIndices() {
      return componentProps.disabledIndices;
    },
    get modifierKeys() {
      return componentProps.modifierKeys;
    },
  });

  // Created lazily inside the CompositeList provider so items can read its context.
  const element = () =>
    useRenderElement(untrack(() => componentProps.tag) ?? 'div', componentProps, {
      state: () => componentProps.state ?? (EMPTY_OBJECT as State),
      ref: [composite.rootRef, componentProps.refs ?? EMPTY_ARRAY],
      props: () => [composite.props, ...(componentProps.props ?? EMPTY_ARRAY), elementProps],
      stateAttributesMapping: componentProps.stateAttributesMapping,
    });

  const contextValue: CompositeRootContext = {
    get highlightedIndex() {
      return composite.highlightedIndex();
    },
    onHighlightedIndexChange: composite.onHighlightedIndexChange,
    get highlightItemOnHover() {
      return componentProps.highlightItemOnHover ?? false;
    },
    relayKeyboardEvent: composite.relayKeyboardEvent,
  };

  return (
    <CompositeRootContext value={contextValue}>
      <CompositeList<Metadata>
        elementsRef={composite.elementsRef}
        onMapChange={(newMap) => {
          componentProps.onMapChange?.(newMap);
          composite.onMapChange(newMap);
        }}
      >
        {untrack(element)}
      </CompositeList>
    </CompositeRootContext>
  );
}

export interface CompositeRootState {}

export interface CompositeRootProps<Metadata, State extends Record<string, any>> extends Pick<
  BaseUIComponentProps<'div', State>,
  'render' | 'class' | 'children' | 'style'
> {
  props?: PropsInput[] | undefined;
  state?: State | undefined;
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  refs?: RefInput<HTMLElement | null>[] | undefined;
  tag?: keyof JSX.IntrinsicElements | undefined;
  orientation?: 'horizontal' | 'vertical' | 'both' | undefined;
  grid?: CompositeGridNavigator | undefined;
  loopFocus?: boolean | undefined;
  onLoop?:
    | ((
        event: KeyboardEvent,
        prevIndex: number,
        nextIndex: number,
        elementsRef: RefObject<Array<HTMLElement | null>>,
      ) => number)
    | undefined;
  highlightedIndex?: number | undefined;
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  enableHomeAndEndKeys?: boolean | undefined;
  onMapChange?: ((newMap: Map<Node, CompositeMetadata<Metadata>>) => void) | undefined;
  onKeyDown?: ((event: BaseUIEvent<KeyboardEvent>) => void) | undefined;
  stopEventPropagation?: boolean | undefined;
  rootRef?: RefInput<HTMLElement | null> | undefined;
  disabledIndices?: number[] | undefined;
  modifierKeys?: ModifierKey[] | undefined;
  highlightItemOnHover?: boolean | undefined;
  ref?: RefInput<HTMLElement> | undefined;
  [key: string]: any;
}

export namespace CompositeRoot {
  export type State = CompositeRootState;
  export type Props<Metadata, TState extends Record<string, any>> = CompositeRootProps<
    Metadata,
    TState
  >;
}
