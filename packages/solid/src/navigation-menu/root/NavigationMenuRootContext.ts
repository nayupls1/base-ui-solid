import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@base-ui-solid/utils/types';
import type { FloatingRootStore } from '../../utils/popups/floating-root/FloatingRootStore';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { NavigationMenuRoot } from './NavigationMenuRoot';

export type NavigationMenuPopupAutoSizeResetState = {
  abortController: AbortController | null;
  owner: any;
};

export interface NavigationMenuRootContext<Value = any> {
  open: boolean;
  value: NavigationMenuRoot.Value<Value>;
  setValue: (
    value: NavigationMenuRoot.Value<Value>,
    eventDetails: Omit<NavigationMenuRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) => void;
  transitionStatus: TransitionStatus;
  mounted: boolean;
  popupElement: HTMLElement | null;
  setPopupElement: (
    value: HTMLElement | null | ((prev: HTMLElement | null) => HTMLElement | null),
  ) => void;
  positionerElement: HTMLElement | null;
  setPositionerElement: (
    value: HTMLElement | null | ((prev: HTMLElement | null) => HTMLElement | null),
  ) => void;
  viewportElement: HTMLElement | null;
  setViewportElement: (
    value: HTMLElement | null | ((prev: HTMLElement | null) => HTMLElement | null),
  ) => void;
  viewportTargetElement: HTMLElement | null;
  setViewportTargetElement: (
    value: HTMLElement | null | ((prev: HTMLElement | null) => HTMLElement | null),
  ) => void;
  activationDirection: 'left' | 'right' | 'up' | 'down' | null;
  setActivationDirection: (value: 'left' | 'right' | 'up' | 'down' | null) => void;
  floatingRootStore: FloatingRootStore | undefined;
  setFloatingRootStore: (
    value:
      | FloatingRootStore
      | undefined
      | ((prev: FloatingRootStore | undefined) => FloatingRootStore | undefined),
  ) => void;
  currentContentRef: RefObject<HTMLDivElement | null>;
  nested: boolean;
  rootRef: RefObject<HTMLDivElement | null>;
  beforeInsideRef: RefObject<HTMLSpanElement | null>;
  afterInsideRef: RefObject<HTMLSpanElement | null>;
  beforeOutsideRef: RefObject<HTMLSpanElement | null>;
  afterOutsideRef: RefObject<HTMLSpanElement | null>;
  prevTriggerElementRef: RefObject<Element | null | undefined>;
  popupAutoSizeResetRef: RefObject<NavigationMenuPopupAutoSizeResetState>;
  delay: number;
  closeDelay: number;
  orientation: 'horizontal' | 'vertical';
  viewportInert: boolean;
  setViewportInert: (value: boolean | ((prev: boolean) => boolean)) => void;
}

export const NavigationMenuRootContext = createContext<NavigationMenuRootContext<any> | null>(null);

function useNavigationMenuRootContext<Value = any>(
  optional?: false,
): NavigationMenuRootContext<Value>;
function useNavigationMenuRootContext<Value = any>(
  optional: true,
): NavigationMenuRootContext<Value> | undefined;
function useNavigationMenuRootContext<Value = any>(optional?: boolean) {
  const context = useContext(NavigationMenuRootContext) as
    NavigationMenuRootContext<Value> | undefined;
  if (context == null && !optional) {
    throw new Error(
      'Base UI: NavigationMenuRootContext is missing. Navigation Menu parts must be placed within <NavigationMenu.Root>.',
    );
  }
  return context ?? undefined;
}

export const NavigationMenuTreeContext = createContext<string | null>(null);

function useNavigationMenuTreeContext() {
  return useContext(NavigationMenuTreeContext);
}

export { useNavigationMenuRootContext, useNavigationMenuTreeContext };
