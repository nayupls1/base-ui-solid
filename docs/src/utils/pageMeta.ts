export function setPageMeta(meta: { title?: string; description?: string; subtitle?: string }) {
  if (typeof document === 'undefined') {
    return;
  }
  if (meta.title) {
    document.title = meta.title;
  }
  if (meta.description) {
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'description';
      document.head.appendChild(tag);
    }
    tag.content = meta.description;
  }
}
