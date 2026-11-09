import { createEffect, untrack, type Accessor } from 'solid-js';
import { useFieldRootContext } from './FieldRootContext';

/**
 * Returns the field's `setFocused`, recording which control the focused state belongs to.
 *
 * Disabling or unmounting a focused control moves focus away without firing `blur`, so the focused
 * state would otherwise stay latched. A field can have several focus targets, so a control only
 * clears the shared state when focus last landed on itself. The callback doubles as that
 * identity.
 */
export function useSetFieldFocused(
  disabled: Accessor<boolean | undefined>,
  focusTarget: Accessor<Element | null | undefined>,
  onFocusedChange?: ((focused: boolean) => void) | undefined,
) {
  const { setFocused, focusOwnerRef } = useFieldRootContext();

  const setFieldFocused = (focused: boolean) => {
    if (focused ? !untrack(disabled) : focusOwnerRef.current === setFieldFocused) {
      focusOwnerRef.current = focused && setFieldFocused;
      onFocusedChange?.(focused);
      setFocused(focused);
    }
  };

  createEffect(
    () => [disabled(), focusTarget()] as const,
    ([, el]) => {
      const root = el?.getRootNode() as Document | ShadowRoot | undefined;
      if (root?.activeElement === el && el) {
        setFieldFocused(true);
      }
      return () => {
        setFieldFocused(false);
      };
    },
  );

  return setFieldFocused;
}
