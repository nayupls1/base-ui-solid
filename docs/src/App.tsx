import { createEffect, For, lazy, Loading, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createRouter, useLocation, useNavigate } from '@solidjs/router';
import * as SideNav from './components/SideNav';
import * as QuickNav from './components/QuickNav/QuickNav';
import { Header } from './components/Header';
import { MAIN_CONTENT_ID } from './components/SkipNav';
import { GitHubIcon } from './icons/GitHubIcon';
import { NpmIcon } from './icons/NpmIcon';
import { mdxComponents } from './mdx-components';
import { componentPages, sitemap } from './sitemap';
import { getDisplayTitle } from './utils/getDisplayTitle';
import { setPageMeta } from './utils/pageMeta';

function MdxPage(props: { load: () => Promise<any> }) {
  const Content = lazy(async () => {
    const module = await props.load();
    const MDXContent = module.default;
    return {
      default: () => {
        onSettled(() => {
          const heading = document.querySelector(`#${MAIN_CONTENT_ID} h1`);
          if (heading?.textContent) {
            setPageMeta({ title: `${heading.textContent} · Base UI Solid` });
          }
          if (window.location.hash) {
            document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView();
          }
        });
        return <MDXContent components={mdxComponents} />;
      },
    };
  });
  return (
    <Loading fallback={null}>
      <Content />
    </Loading>
  );
}

function Redirect(props: { to: string }) {
  const navigate = useNavigate();
  onSettled(() => {
    navigate(props.to, { replace: true });
  });
  return null;
}

const firstPage = componentPages[0]?.href ?? '/';

export const Router = createRouter({
  routes: [
    { path: '/', component: () => <Redirect to={firstPage} /> },
    { path: '/solid/components', component: () => <Redirect to={firstPage} /> },
    ...componentPages.map((page) => ({
      path: page.href,
      component: () => <MdxPage load={page.load} />,
    })),
    { path: '*404', component: () => <h1 class="MdH1">Page not found</h1> },
  ],
});

function ScrollToTopOnNavigate() {
  const location = useLocation();
  createEffect(
    () => location.pathname,
    () => {
      if (!window.location.hash) {
        window.scrollTo({ top: 0 });
      }
    },
  );
  return null;
}

export function Layout(props: { children?: JSX.Element }) {
  return (
    <div class="RootLayout">
      <ScrollToTopOnNavigate />
      <div class="RootLayoutContainer">
        <div class="RootLayoutContent">
          <div class="ContentLayoutRoot">
            <Header />
            <SideNav.Root>
              <For each={Object.entries(sitemap)}>
                {(entry) => (
                  <SideNav.Section>
                    <SideNav.Heading>{entry[0]}</SideNav.Heading>
                    <SideNav.List>
                      <For each={entry[1].pages}>
                        {(page) => (
                          <SideNav.Item href={page.href}>
                            {getDisplayTitle(page.title)}
                          </SideNav.Item>
                        )}
                      </For>
                    </SideNav.List>
                  </SideNav.Section>
                )}
              </For>
              <SideNav.Separator />
              <SideNav.Section>
                <SideNav.List>
                  <SideNav.Item href="https://github.com/mui/base-ui" icon={<GitHubIcon />} external>
                    GitHub
                  </SideNav.Item>
                  <SideNav.Item
                    href="https://www.npmjs.com/package/@base-ui/react"
                    icon={<NpmIcon />}
                    external
                  >
                    <span>upstream npm</span>
                  </SideNav.Item>
                </SideNav.List>
              </SideNav.Section>
            </SideNav.Root>
            <main class="ContentLayoutMain" id={MAIN_CONTENT_ID}>
              <QuickNav.Container>{props.children}</QuickNav.Container>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return <Router>{(props: { children?: JSX.Element }) => <Layout>{props.children}</Layout>}</Router>;
}
