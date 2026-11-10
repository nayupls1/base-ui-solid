import { visuallyHiddenInput } from 'base-ui-solidjs-utils/visuallyHidden';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { assignRefs, type RefInput } from '../../internals/useRenderElement';

type DismissEvent = MouseEvent | KeyboardEvent;

/**
 * A visually hidden button that lets screen reader users dismiss the popup.
 *
 * @internal
 */
export function ComboboxInternalDismissButton(props: { ref?: RefInput<HTMLSpanElement> }) {
  const store = useComboboxRootContext();

  const { buttonRef, getButtonProps } = useButton({
    native: false,
  });

  function handleDismiss(event: DismissEvent) {
    store.setOpen(
      false,
      createChangeEventDetails(
        REASONS.closePress,
        event,
        event.currentTarget as HTMLElement,
      ) as any,
    );
  }

  const dismissProps = getButtonProps({
    onClick: handleDismiss,
  } as any);

  return (
    <span
      ref={(el: HTMLSpanElement) => {
        assignRefs(buttonRef as RefInput<HTMLSpanElement>, el);
        assignRefs(props.ref, el);
      }}
      {...(dismissProps as any)}
      aria-label="Dismiss"
      tabindex={undefined}
      style={visuallyHiddenInput}
    />
  );
}
