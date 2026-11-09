import { Show, untrack } from 'solid-js';
import { DialogInteractions } from './useDialogRoot';
import { DialogRootContext, useDialogRootContext } from './DialogRootContext';
import { DialogStore } from '../store/DialogStore';
import type { DialogRootProps } from './DialogRoot';
import {
  renderPopupRootChildren,
  usePopupRoot,
  usePopupRootSync,
} from '../../utils/popups/popupRoot';

export function useRenderDialogRoot<Payload>(
  mode: DialogRootMode,
  props: DialogRootProps<Payload>,
) {
  const isDrawer = mode === 'drawer';
  const isAlertDialog = mode === 'alert-dialog';
  const modal = () => (isAlertDialog ? true : (props.modal ?? true));
  const disablePointerDismissal = () =>
    isAlertDialog || (props.disablePointerDismissal ?? false);
  const role: 'dialog' | 'alertdialog' = isAlertDialog ? 'alertdialog' : 'dialog';

  const parentStore = useDialogRootContext(true);
  const nested = parentStore != null;
  const rootState = () => ({
    modal: modal(),
    disablePointerDismissal: disablePointerDismissal(),
    nested,
    role,
  });

  const { store, open, mounted, payload } = usePopupRoot(
    props,
    (initialState, defaultPopupId) =>
      new DialogStore<Payload>({ ...initialState, ...rootState() }, defaultPopupId),
  );

  store.useSyncedValues(rootState);

  usePopupRootSync(store, open);

  // Detached triggers share this one Root, so mounting its interactions eagerly is cheap. The
  // trigger props they publish then stay stable, so opening and closing doesn't re-render inactive
  // triggers.
  const shouldRenderInteractions = () => open() || mounted() || props.handle != null;

  return (
    <DialogRootContext value={store as DialogStore<unknown>}>
      {untrack(() =>
        renderPopupRootChildren({
          store,
          handle: props.handle as any,
          interactions: () => (
            <Show when={shouldRenderInteractions()}>
              <DialogInteractions
                store={store}
                parentContext={parentStore?.context}
                isDrawer={isDrawer}
              />
            </Show>
          ),
          children: () => props.children as any,
          payload,
        }),
      )}
    </DialogRootContext>
  );
}

type DialogRootMode = 'dialog' | 'drawer' | 'alert-dialog';
