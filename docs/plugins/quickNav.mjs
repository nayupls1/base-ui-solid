import GithubSlugger from 'github-slugger';
import { visit } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';

/**
 * A markdown link definition `[//]: # '@exclude-table-of-contents'` marks the next heading
 * so it's left out of the table of contents.
 */
export function remarkQuickNavExcludeHeading() {
  return (tree) => {
    visit(tree, 'definition', (node, index, parent) => {
      if (node.label !== '//' || node.title !== '@exclude-table-of-contents' || !parent) {
        return;
      }
      for (let i = index + 1; i < parent.children.length; i += 1) {
        const next = parent.children[i];
        if (next.type === 'heading') {
          next.data ??= {};
          next.data.hProperties = { ...next.data.hProperties, 'data-exclude-toc': '' };
          break;
        }
      }
    });
  };
}

function mdxElement(name, children = [], props = {}) {
  return {
    type: 'mdxJsxFlowElement',
    name,
    attributes: Object.entries(props).map(([key, value]) => ({
      type: 'mdxJsxAttribute',
      name: key,
      value,
    })),
    children,
  };
}

function entryToNode({ value, depth, id, children }) {
  const sub = mdxElement('QuickNav.List');
  // Ignore <h4>'s and below
  if (depth < 3 && children?.length) {
    sub.children = children.map(entryToNode);
  }

  if (depth === 1) {
    sub.children.unshift(entryToNode({ value: '(Top)', id: '', depth: 2 }));
    return [mdxElement('QuickNav.Title', [{ type: 'text', value }]), sub];
  }

  const link = mdxElement('QuickNav.Link', [{ type: 'text', value }], { href: `#${id}` });
  return mdxElement('QuickNav.Item', [link, sub]);
}

/**
 * Adds slugs to headings and wraps the page into `<QuickNav.Root>` (the table of contents) and
 * `<QuickNav.Content>`, like the upstream docs.
 */
export function rehypeQuickNav() {
  return (tree) => {
    const slugger = new GithubSlugger();
    const toc = [];
    const stack = [];

    visit(tree, 'element', (node) => {
      const match = /^h([1-6])$/.exec(node.tagName);
      if (!match) {
        return;
      }
      const depth = Number(match[1]);
      const text = toString(node).trim();
      const id = node.properties?.id ?? slugger.slug(text);
      node.properties = { ...node.properties, id };

      if (depth > 3 || 'dataExcludeToc' in (node.properties ?? {})) {
        return;
      }

      const entry = { value: text, depth, id, children: [] };
      while (stack.length && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }
      if (stack.length) {
        stack[stack.length - 1].children.push(entry);
      } else {
        toc.push(entry);
      }
      stack.push(entry);
    });

    // Keep ESM (imports/exports) at the top level.
    const esm = tree.children.filter((node) => node.type === 'mdxjsEsm');
    const rest = tree.children.filter((node) => node.type !== 'mdxjsEsm');
    const content = mdxElement('QuickNav.Content', rest);

    if (!toc.length) {
      tree.children = [...esm, content];
      return;
    }

    const root = mdxElement('QuickNav.Root', toc.flatMap(entryToNode));
    tree.children = [...esm, root, content];
  };
}
