// TODO(solid-port): the rest of usePressAndHold is ported with NumberField.
export function isTouchLikePointerType(pointerType: string) {
  return pointerType === 'touch' || pointerType === 'pen';
}
