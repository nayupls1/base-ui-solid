import { createEffect, createMemo, createSignal, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { getParentNode, isHTMLElement, isLastTraversableNode } from '@floating-ui/utils/dom';
import { ownerWindow } from 'base-ui-solidjs-utils/owner';
import { useRenderElement } from '../../internals/useRenderElement';
import { getCssDimensions } from '../../utils/getCssDimensions';
import { getElementTransform } from '../../utils/getElementTransform';
import type { BaseUIComponentProps } from '../../internals/types';
import type { TabsRoot, TabsRootState } from '../root/TabsRoot';
import { useTabsRootContext } from '../root/TabsRootContext';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsListContext } from '../list/TabsListContext';
import type { TabsTab } from '../tab/TabsTab';
import * as TabsIndicatorCssVars from './TabsIndicatorCssVars';
import { ownedProps } from '../../internals/ownedProps';

const stateAttributesMapping = {
  ...tabsStateAttributesMapping,
  activeTabPosition: () => null,
  activeTabSize: () => null,
};

// The indicator compares rounded layout offsets against fractional rect offsets.
const MAX_LAYOUT_ROUNDING_ERROR = 2;

interface IndicatorLayout {
  isTabSelected: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

const EMPTY_LAYOUT: IndicatorLayout = {
  isTabSelected: false,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  width: 0,
  height: 0,
};

/**
 * A visual indicator that can be styled to match the position of the currently active tab.
 * Renders a `<span>` element.
 *
 * `renderBeforeHydration` is accepted for API parity but has no effect: this port renders on the
 * client, so there is no pre-hydration layout to patch.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsIndicator(componentProps: TabsIndicator.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'class',
    'render',
    'renderBeforeHydration',
    'style',
    'children',
    'ref',
  );

  const rootContext = useTabsRootContext();
  const listContext = useTabsListContext();

  const [version, setVersion] = createSignal(0, { ownedWrite: true });
  const [layout, setLayout] = createSignal<IndicatorLayout>(EMPTY_LAYOUT, { ownedWrite: true });

  createEffect(
    () => 0,
    () => listContext.registerIndicatorUpdateListener(() => {
      setVersion((v) => v + 1);
    }),
  );

  createEffect(
    () => [rootContext.value, listContext.tabsListElement, version(), rootContext.tabActivationDirection] as const,
    ([value, tabsListElement]) => {
      setLayout(computeLayout(value, tabsListElement));
    },
  );

  function computeLayout(value: TabsTab.Value, tabsListElement: HTMLElement | null): IndicatorLayout {
    let left = 0;
    let right = 0;
    let top = 0;
    let bottom = 0;
    let width = 0;
    let height = 0;

    let isTabSelected = false;

    if (value != null && tabsListElement != null) {
      const activeTab = rootContext.getTabElementBySelectedValue(value);

      if (activeTab != null) {
        isTabSelected = true;

        const { width: computedWidth, height: computedHeight } = getCssDimensions(activeTab);
        const { width: tabListWidth, height: tabListHeight } = getCssDimensions(tabsListElement);
        const tabRect = activeTab.getBoundingClientRect();
        const tabsListRect = tabsListElement.getBoundingClientRect();
        const scaleX = tabListWidth > 0 ? tabsListRect.width / tabListWidth : 1;
        const scaleY = tabListHeight > 0 ? tabsListRect.height / tabListHeight : 1;

        const layoutOffset = getLayoutOffset(activeTab, tabsListElement);
        left = layoutOffset.left;
        top = layoutOffset.top;

        const rectLeft =
          (tabRect.left - tabsListRect.left) / scaleX +
          tabsListElement.scrollLeft -
          tabsListElement.clientLeft;
        const rectTop =
          (tabRect.top - tabsListRect.top) / scaleY +
          tabsListElement.scrollTop -
          tabsListElement.clientTop;

        const tabTranslation = getActiveTabTranslation(activeTab);
        if (
          Math.abs(rectLeft - tabTranslation.x - left) <= MAX_LAYOUT_ROUNDING_ERROR &&
          Math.abs(rectTop - tabTranslation.y - top) <= MAX_LAYOUT_ROUNDING_ERROR
        ) {
          left = rectLeft;
          top = rectTop;
        }

        width = computedWidth;
        height = computedHeight;
        right = tabsListElement.scrollWidth - left - width;
        bottom = tabsListElement.scrollHeight - top - height;
      }
    }

    return { isTabSelected, left, right, top, bottom, width, height };
  }

  const state = createMemo<TabsIndicatorState>(() => {
    const { isTabSelected, left, right, top, bottom, width, height } = layout();
    return {
      orientation: rootContext.orientation,
      activeTabPosition: isTabSelected ? { left, right, top, bottom } : null,
      activeTabSize: isTabSelected ? { width, height } : null,
      tabActivationDirection: rootContext.tabActivationDirection,
    };
  });

  return untrack(() =>
    useRenderElement('span', componentProps, {
      enabled: () => rootContext.value != null,
      state,
      props: [
        {
          role: 'presentation',
          get style(): JSX.CSSProperties | undefined {
            const { isTabSelected, left, right, top, bottom, width, height } = layout();
            return isTabSelected
              ? {
                  [TabsIndicatorCssVars.activeTabLeft]: `${left}px`,
                  [TabsIndicatorCssVars.activeTabRight]: `${right}px`,
                  [TabsIndicatorCssVars.activeTabTop]: `${top}px`,
                  [TabsIndicatorCssVars.activeTabBottom]: `${bottom}px`,
                  [TabsIndicatorCssVars.activeTabWidth]: `${width}px`,
                  [TabsIndicatorCssVars.activeTabHeight]: `${height}px`,
                }
              : undefined;
          },
          get hidden() {
            const { isTabSelected, width, height } = layout();
            // do not display the indicator before the layout is settled
            return !(isTabSelected && width > 0 && height > 0);
          },
        },
        elementProps,
      ],
      stateAttributesMapping,
    }),
  );
}

export interface TabsIndicatorState extends TabsRootState {
  /**
   * The active tab position.
   */
  activeTabPosition: TabsTab.Position | null;
  /**
   * The active tab size.
   */
  activeTabSize: TabsTab.Size | null;
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
}

export interface TabsIndicatorProps extends BaseUIComponentProps<'span', TabsIndicatorState> {
  /**
   * Whether to render itself before hydration. Has no effect in this port.
   * This minimizes the time that the indicator isn't visible after server-side rendering.
   * @default false
   */
  renderBeforeHydration?: boolean | undefined;
}

export namespace TabsIndicator {
  export type State = TabsIndicatorState;
  export type Props = TabsIndicatorProps;
}

function getLayoutOffset(element: HTMLElement, ancestor: HTMLElement) {
  const elementOffset = getCumulativeOffset(element);
  const ancestorOffset = getCumulativeOffset(ancestor);

  let left = elementOffset.left - ancestorOffset.left - ancestor.clientLeft;
  let top = elementOffset.top - ancestorOffset.top - ancestor.clientTop;

  // `offsetLeft`/`offsetTop` describe layout, and scrolling doesn't change layout: a scroll
  // container between the tab and the list moves the tab on screen while its layout slot stays
  // put. Subtract that scroll so this offset remains comparable with the rect-based one below —
  // otherwise the difference reads as transform distortion, the rect offset is rejected, and the
  // indicator is left behind by the full scroll amount. The list's own scroll is deliberately
  // excluded: the indicator sits inside it and scrolls along with the tab.
  //
  // `getParentNode` crosses shadow boundaries (and slots), so a tab inside a shadow root still
  // reaches the scroll containers between it and the list.
  let node: Node | null = getParentNode(element);
  while (isHTMLElement(node) && node !== ancestor && !isLastTraversableNode(node)) {
    left -= node.scrollLeft;
    top -= node.scrollTop;
    node = getParentNode(node);
  }

  return { left, top };
}

function getCumulativeOffset(element: HTMLElement) {
  let left = 0;
  let top = 0;
  let currentElement: HTMLElement | null = element;

  while (currentElement != null) {
    left += currentElement.offsetLeft;
    top += currentElement.offsetTop;

    const offsetParent = currentElement.offsetParent as HTMLElement | null;
    if (offsetParent != null) {
      left += offsetParent.clientLeft;
      top += offsetParent.clientTop;
    }

    currentElement = offsetParent;
  }

  return { left, top };
}

// Returns the active tab's own 2D translation, in CSS pixels: the translation component of
// the computed `transform` matrix plus the `translate` longhand. CSS composes the two as
// `translate → rotate → scale → transform`, so adding them is only exact when no rotation or
// scale is in play. That is enough here: with either of those present the caller's agreement
// check rejects the rect-based offset regardless of the translation, and the tab's layout
// slot is used instead.
function getActiveTabTranslation(element: HTMLElement) {
  const computedStyle = ownerWindow(element).getComputedStyle(element);
  const { x, y } = getElementTransform(element, computedStyle);
  let translateX = x;
  let translateY = y;

  // The `translate` longhand is a separate property and is not reflected in the
  // computed `transform` matrix that `getElementTransform` reads. `getComputedStyle`
  // resolves absolute and font-relative lengths to pixels but keeps percentages, which
  // resolve against the tab's border box.
  const { translate } = computedStyle;
  if (translate && translate !== 'none') {
    const parts = translate.split(' ');
    translateX += resolveTranslateLength(parts[0], element.offsetWidth);
    translateY += resolveTranslateLength(parts[1], element.offsetHeight);
  }

  return { x: translateX, y: translateY };
}

// Resolves a single `translate` longhand component to pixels. Percentages resolve against
// the given border-box size; anything that isn't a plain number or percentage (e.g.
// `calc(...)`) is treated as no translation, so the indicator falls back to the tab's
// layout slot rather than guessing.
function resolveTranslateLength(value: string | undefined, referenceSize: number): number {
  if (!value) {
    return 0;
  }
  const numeric = parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return value.endsWith('%') ? (numeric / 100) * referenceSize : numeric;
}
