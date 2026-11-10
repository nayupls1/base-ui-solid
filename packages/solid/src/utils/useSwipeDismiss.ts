// TODO(solid-port): only `getDisplacement` is ported so far; the rest of the hook arrives with Drawer.
export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export function getDisplacement(direction: SwipeDirection, deltaX: number, deltaY: number) {
  switch (direction) {
    case 'up':
      return -deltaY;
    case 'down':
      return deltaY;
    case 'left':
      return -deltaX;
    case 'right':
      return deltaX;
    default:
      return 0;
  }
}
