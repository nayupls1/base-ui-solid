import { createEffect, createMemo, omit, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useLocation } from '@solidjs/router';
import { ScrollArea } from '@base-ui-solid/solid/scroll-area';
import { HEADER_HEIGHT_DESKTOP } from './Header';
import './SideNav.css';

export function Root(props: JSX.HTMLAttributes<HTMLElement>) {
  return (
    <nav aria-label="Main navigation" {...props} class={['SideNavRoot', props.class]}>
      <ScrollArea.Root>
        <ScrollArea.Viewport data-side-nav-viewport class="SideNavViewport">
          {props.children}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar class="SideNavScrollbar" orientation="vertical">
          <ScrollArea.Thumb class="SideNavScrollbarThumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </nav>
  );
}

export function Section(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} class={['SideNavSection', props.class]} />;
}

export function Heading(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} class={['SideNavHeading', props.class]} />;
}

export function Separator(props: JSX.HTMLAttributes<HTMLHRElement>) {
  return <hr {...props} class={['SideNavSeparator', props.class]} />;
}

export function List(props: JSX.HTMLAttributes<HTMLUListElement>) {
  return <ul {...props} class={['SideNavList', props.class]} />;
}

export function Badge(props: JSX.HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} class={['SideNavBadge', props.class]} />;
}

interface ItemProps extends JSX.LiHTMLAttributes<HTMLLIElement> {
  href: string;
  external?: boolean;
  icon?: JSX.Element;
}

const SCROLL_MARGIN = 48;

export function Item(props: ItemProps) {
  const rest = omit(props, 'children', 'class', 'href', 'external', 'icon');
  let li: HTMLLIElement | undefined;
  const location = useLocation();
  const exactActive = createMemo(() => location.pathname === props.href);
  const active = createMemo(
    () => exactActive() || location.pathname.startsWith(`${props.href}/`),
  );

  createEffect(active, (isActive) => {
    if (!li || !isActive) {
      return;
    }
    const viewport = document.querySelector<HTMLElement>('[data-side-nav-viewport]');
    if (!viewport) {
      return;
    }
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const scrollMargin = (SCROLL_MARGIN * rem) / 16;
    const headerHeight = (HEADER_HEIGHT_DESKTOP * rem) / 16;
    const itemRect = li.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    if (itemRect.top < viewportRect.top + headerHeight) {
      viewport.scrollTop += itemRect.top - viewportRect.top - scrollMargin;
    } else if (itemRect.bottom > viewportRect.bottom) {
      viewport.scrollTop += itemRect.bottom - viewportRect.bottom + scrollMargin;
    }
  });

  const content = () => (
    <Show when={props.icon} fallback={props.children}>
      <div class="SideNavLinkIconContainer">
        {props.icon}
        {props.children}
      </div>
    </Show>
  );

  return (
    <li ref={li} {...rest} class={['SideNavItem', props.class]}>
      <Show
        when={!props.external}
        fallback={
          <a class="SideNavLink" href={props.href}>
            {content()}
          </a>
        }
      >
        <a
          class="SideNavLink"
          href={props.href}
          data-active={active() || undefined}
          aria-current={active() ? (exactActive() ? 'page' : 'location') : undefined}
          onClick={() => {
            if (exactActive()) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          {content()}
        </a>
      </Show>
    </li>
  );
}
