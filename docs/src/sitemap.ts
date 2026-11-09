export interface SitemapPage {
  title: string;
  slug: string;
  href: string;
}

const pageModules = import.meta.glob('./pages/components/*/page.mdx');

const TITLE_OVERRIDES: Record<string, string> = {
  'otp-field': 'OTP Field',
};

function titleFromSlug(slug: string) {
  return (
    TITLE_OVERRIDES[slug] ??
    slug
      .split('-')
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' ')
  );
}

export const componentPages: Array<SitemapPage & { load: () => Promise<any> }> = Object.entries(
  pageModules,
)
  .map(([file, load]) => {
    const slug = file.split('/').at(-2)!;
    return {
      title: titleFromSlug(slug),
      slug,
      href: `/solid/components/${slug}`,
      load: load as () => Promise<any>,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

export const sitemap: Record<string, { pages: SitemapPage[] }> = {
  Components: { pages: componentPages },
};
