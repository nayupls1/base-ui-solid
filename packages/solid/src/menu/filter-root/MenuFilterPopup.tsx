import { useMenuFilterPopup } from './useMenuFilterPopup';
import type { FloatingFocusManagerProps } from '../../utils/popups/focus/FloatingFocusManager';
import { MenuPopupPlain } from '../popup/MenuPopup';
import type { MenuPopupProps } from '../popup/MenuPopup';
import { useMenuRootContext } from '../root/MenuRootContext';
import { reactiveMergeProps } from '../../internals/reactiveMergeProps';
import { REASONS } from '../../internals/reasons';

/**
 * The popup of a filterable menu. It renders as a dialog that contains the input and the list.
 *
 * @internal
 */
export function MenuFilterPopup(props: MenuPopupProps) {
  const rootContext = useMenuRootContext();
  const { store } = rootContext;

  const open = store.useState('open');
  const parent = store.useState('parent');
  const openMethod = store.useState('openMethod');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');

  const interactionProps = useMenuFilterPopup(() => rootContext.orientation);

  // The input holds real focus; the popup is never the focus target.
  const initialFocus = (): FloatingFocusManagerProps['initialFocus'] => {
    const reason = lastOpenChangeReason();
    const isOpen = open();
    const method = openMethod();
    const openedByHover = isOpen && reason === REASONS.triggerHover;
    const mayFocusInput =
      parent().type !== 'menu' ||
      (isOpen &&
        (method === 'keyboard' ||
          reason === REASONS.listNavigation ||
          reason === REASONS.triggerHover ||
          reason === REASONS.triggerPress));

    if (!mayFocusInput) {
      return false;
    }

    return () => {
      // A tap would raise the on-screen keyboard, but a screen reader press (such as an iOS
      // VoiceOver double-tap) still reports a touch and needs the input focused.
      const touchOpen = (method === 'touch' || method === 'pen') && !store.context.virtualPress;
      if (openedByHover || touchOpen) {
        return false;
      }
      return store.context.virtualFocusRef?.current ?? false;
    };
  };

  const popupProps = reactiveMergeProps(interactionProps as any, props as any);

  return <MenuPopupPlain {...(popupProps as any)} role="dialog" initialFocus={initialFocus()} />;
}
