import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';
import { highlightToFramesHast } from './highlight.mjs';

/**
 * Removes upstream's `@highlight` annotations, which only affect upstream's highlighter.
 */
export function stripHighlightComments(source) {
  return source
    .split('\n')
    .filter((line) => !/^\s*\/\/ @highlight/.test(line) && !/^\s*\{\/\* @highlight.*\*\/\}\s*$/.test(line))
    .map((line) =>
      line
        .replace(/\s*\/\/ @highlight(-text)?( "[^"]*")*\s*$/, '')
        .replace(/\s*\{\/\* @highlight(-text)?( "[^"]*")* \*\/\}/g, ''),
    )
    .join('\n');
}

/**
 * Highlights fenced code blocks with starry-night and adds the docs' code block classes.
 */
export function rehypeHighlightCode() {
  return async (tree) => {
    const jobs = [];
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'pre') {
        return;
      }
      const code = node.children.find((child) => child.type === 'element' && child.tagName === 'code');
      if (!code) {
        return;
      }
      const className = (code.properties?.className ?? []).find((name) =>
        String(name).startsWith('language-'),
      );
      const language = className ? String(className).slice('language-'.length) : 'text';
      const source = stripHighlightComments(toString(code).replace(/\n$/, ''));
      const meta = code.data?.meta ?? '';
      const title = /title="([^"]*)"/.exec(meta)?.[1];
      if (title) {
        node.properties = { ...node.properties, dataTitle: title };
      }
      jobs.push(
        highlightToFramesHast(source, language).then((highlighted) => {
          code.children = highlighted.children;
          code.properties = { ...code.properties, dataLanguage: language };
        }),
      );
    });
    await Promise.all(jobs);
  };
}

const blockProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeHighlightCode)
  .use(rehypeStringify);

export async function renderMarkdown(markdown) {
  return String(await blockProcessor.process(markdown));
}

export async function renderMarkdownInline(markdown) {
  const html = await renderMarkdown(markdown);
  return html.replace(/^<p>/, '').replace(/<\/p>\n?$/, '');
}
