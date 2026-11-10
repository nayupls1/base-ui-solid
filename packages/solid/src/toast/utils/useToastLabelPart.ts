import {
  children as resolveChildren,
  createEffect,
  createMemo,
  onCleanup,
  type Accessor,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useToastRootContext } from '../root/ToastRootContext';
import { hasRenderableChildren } from './isRenderableNode';

/**
 * Resolves the id, children and setter shared by `Toast.Title` and `Toast.Description`.
 * Children fall back to the toast's `title`/`description`.
 */
export function useToastLabelPart(
  idProp: Accessor<string | undefined>,
  childrenProp: Accessor<JSX.Element>,
  part: 'title' | 'description',
) {
  const root = useToastRootContext();

  const setId = part === 'title' ? root.setTitleId : root.setDescriptionId;
  const resolvedChildProp = resolveChildren(childrenProp);
  const children = createMemo<JSX.Element>(() => {
    const own = resolvedChildProp();
    const ownList = Array.isArray(own) ? own : [own];
    if (own != null && ownList.length > 0) {
      return own;
    }
    return (part === 'title' ? root.toast.title : root.toast.description) as JSX.Element;
  });

  const id = useBaseUiId(idProp);

  return {
    id,
    children,
    type: () => root.toast.type,
    setId,
  };
}

/**
 * Registers the label id on the toast root while the part has renderable content.
 * Returns whether the part should render.
 */
export function useToastLabelElement(
  children: Accessor<JSX.Element>,
  id: Accessor<string | undefined>,
  setId: (value: string | undefined | ((prev: string | undefined) => string | undefined)) => void,
): Accessor<boolean> {
  const shouldRender = createMemo(() => hasRenderableChildren(children()));

  createEffect(
    () => [shouldRender(), id()] as const,
    ([render, currentIdValue]) => {
      if (!render) {
        return undefined;
      }

      setId(currentIdValue);
      return () => {
        setId((currentId) => (currentId === currentIdValue ? undefined : currentId));
      };
    },
  );

  return shouldRender;
}
