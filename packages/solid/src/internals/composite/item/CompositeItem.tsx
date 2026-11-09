import type { JSX } from '@solidjs/web';
import { omit, untrack } from 'solid-js';
import { EMPTY_OBJECT, EMPTY_ARRAY } from '@base-ui-solid/utils/empty';
import { useRenderElement, type PropsInput, type RefInput } from '../../useRenderElement';
import { useCompositeItem } from './useCompositeItem';
import type { BaseUIComponentProps } from '../../types';
import type { StateAttributesMapping } from '../../getStateAttributesProps';

/**
 * @internal
 */
export function CompositeItem<Metadata, State extends Record<string, any>>(
  componentProps: CompositeItem.Props<Metadata, State>,
) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'state',
    'props',
    'refs',
    'metadata',
    'stateAttributesMapping',
    'tag',
    'children',
    'ref',
  );

  const { compositeProps, compositeRef } = useCompositeItem({
    get metadata() {
      return componentProps.metadata;
    },
  });

  return useRenderElement(untrack(() => componentProps.tag) ?? 'div', componentProps, {
    state: () => componentProps.state ?? (EMPTY_OBJECT as State),
    ref: [compositeRef, componentProps.refs ?? EMPTY_ARRAY],
    props: () => [compositeProps, ...(componentProps.props ?? EMPTY_ARRAY), elementProps],
    stateAttributesMapping: componentProps.stateAttributesMapping,
  });
}

export interface CompositeItemState {}

export interface CompositeItemProps<Metadata, State extends Record<string, any>> extends Pick<
  BaseUIComponentProps<any, State>,
  'render' | 'class' | 'style'
> {
  children?: JSX.Element;
  metadata?: Metadata | undefined;
  refs?: RefInput<HTMLElement | null>[] | undefined;
  props?: PropsInput[] | undefined;
  state?: State | undefined;
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  tag?: keyof JSX.IntrinsicElements | undefined;
  ref?: RefInput<HTMLElement> | undefined;
  [key: string]: any;
}

export namespace CompositeItem {
  export type State = CompositeItemState;
  export type Props<Metadata, TState extends Record<string, any>> = CompositeItemProps<
    Metadata,
    TState
  >;
}
