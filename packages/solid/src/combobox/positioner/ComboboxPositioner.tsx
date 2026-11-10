import { createEffect, Show, untrack } from 'solid-js';
import { inertValue } from '@base-ui-solid/utils/inertValue';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { ComboboxPositionerContext } from './ComboboxPositionerContext';
import { useListEmpty } from '../utils/parts';
import type {
  Side,
  Align,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { useComboboxPortalContext } from '../portal/ComboboxPortalContext';
import { DROPDOWN_COLLISION_AVOIDANCE } from '../../internals/constants';
import { InternalBackdrop } from '../../utils/popups/InternalBackdrop';
import { usePopupPositioner } from '../../utils/popups/popupPositioner';
import { useAnchoredPopupScrollLock } from '../../utils/popups/useAnchoredPopupScrollLock';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Positions the popup against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxPositioner(componentProps: ComboboxPositioner.Props) {
  componentProps = ownedProps(componentProps);
  const store = useComboboxRootContext();
  const keepMounted = useComboboxPortalContext();

  const modal = store.useState('modal');
  const openMethod = store.useState('openMethod');
  const positionerElement = store.useState('positionerElement');
  const triggerElement = store.useState('triggerElement');
  const inputElement = store.useState('inputElement');
  const inputGroupElement = store.useState('inputGroupElement');
  const inputInsidePopup = store.useState('inputInsidePopup');

  const empty = useListEmpty();

  const { element, positioning, open, mounted } =
    usePopupPositioner<ComboboxPositionerInternalState>(
      store as any,
      componentProps as any,
      {
        keepMounted,
        positioning: {
          get anchor() {
            return (
              componentProps.anchor ??
              (inputInsidePopup() ? triggerElement() : (inputGroupElement() ?? inputElement()))
            );
          },
          get collisionAvoidance() {
            return componentProps.collisionAvoidance ?? DROPDOWN_COLLISION_AVOIDANCE;
          },
          lazyFlip: true,
        } as any,
        get state() {
          return { empty: empty() } as any;
        },
      } as any,
    );

  useAnchoredPopupScrollLock(
    () => open() && modal(),
    () => openMethod() === 'touch',
    positionerElement,
    triggerElement,
  );

  createEffect(
    () => positioning.side,
    (side) => {
      store.set('popupSide', side);
    },
  );

  return (
    <ComboboxPositionerContext value={positioning as any}>
      <Show when={mounted() && modal()}>
        <InternalBackdrop
          inert={inertValue(!open())}
          cutout={inputGroupElement() ?? inputElement() ?? triggerElement()}
        />
      </Show>
      {untrack(element)}
    </ComboboxPositionerContext>
  );
}

// The shared positioner state also carries `instant`, which a combobox never sets.
type ComboboxPositionerInternalState = ComboboxPositionerState & { instant: undefined };

export interface ComboboxPositionerState {
  /**
   * Whether the popup is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether there are no items to display.
   */
  empty: boolean;
}

export interface ComboboxPositionerProps
  extends
    UseAnchorPositioningSharedParameters,
    BaseUIComponentProps<'div', ComboboxPositionerState> {}

export namespace ComboboxPositioner {
  export type State = ComboboxPositionerState;
  export type Props = ComboboxPositionerProps;
}
