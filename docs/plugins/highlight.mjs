import { createStarryNight } from '@wooorm/starry-night';
import sourceTsx from '@wooorm/starry-night/source.tsx';
import sourceTs from '@wooorm/starry-night/source.ts';
import sourceCss from '@wooorm/starry-night/source.css';
import sourceShell from '@wooorm/starry-night/source.shell';
import sourceJs from '@wooorm/starry-night/source.js';
import sourceJson from '@wooorm/starry-night/source.json';
import textHtmlBasic from '@wooorm/starry-night/text.html.basic';
import { toHtml } from 'hast-util-to-html';

let starryNightPromise;

export function getStarryNight() {
  starryNightPromise ??= createStarryNight([
    sourceTsx,
    sourceTs,
    sourceCss,
    sourceShell,
    sourceJs,
    sourceJson,
    textHtmlBasic,
  ]);
  return starryNightPromise;
}

const LANGUAGE_ALIASES = {
  ts: 'source.ts',
  typescript: 'source.ts',
  tsx: 'source.tsx',
  jsx: 'source.tsx',
  js: 'source.tsx',
  javascript: 'source.tsx',
  css: 'source.css',
  bash: 'source.shell',
  sh: 'source.shell',
  shell: 'source.shell',
  json: 'source.json',
  html: 'text.html.basic',
};

export function scopeForLanguage(language) {
  return LANGUAGE_ALIASES[language] ?? null;
}

export function languageForFile(fileName) {
  const extension = fileName.split('.').pop();
  return extension;
}

/**
 * Highlights code into a hast root using starry-night (GitHub prettylights classes, `pl-*`).
 * Unknown languages fall back to plain text.
 */
export async function highlightToHast(code, language) {
  const starryNight = await getStarryNight();
  const scope = scopeForLanguage(language);
  if (!scope) {
    return { type: 'root', children: [{ type: 'text', value: code }] };
  }
  return starryNight.highlight(code, scope);
}

export async function highlightToHtml(code, language) {
  return toHtml(await highlightToHast(code, language));
}

function splitLines(nodes) {
  const lines = [[]];
  for (const node of nodes) {
    if (node.type === 'text') {
      node.value.split('\n').forEach((part, index) => {
        if (index > 0) {
          lines.push([]);
        }
        if (part) {
          lines[lines.length - 1].push({ type: 'text', value: part });
        }
      });
    } else if (node.type === 'element') {
      splitLines(node.children).forEach((segment, index) => {
        if (index > 0) {
          lines.push([]);
        }
        if (segment.length) {
          lines[lines.length - 1].push({ ...node, children: segment });
        }
      });
    }
  }
  return lines;
}

function frameNode(lines, startLine, frameType) {
  const children = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      children.push({ type: 'text', value: '\n' });
    }
    children.push({
      type: 'element',
      tagName: 'span',
      properties: { className: ['line'], dataLn: startLine + index },
      children: line,
    });
  });
  return {
    type: 'element',
    tagName: 'span',
    properties: {
      className: ['frame'],
      dataLined: '',
      ...(frameType ? { dataFrameType: frameType } : {}),
    },
    children,
  };
}

/**
 * Highlights code into line-based frames like upstream's docs infra:
 * `<span class="frame" data-lined><span class="line">…</span>…</span>`.
 * Lines from `focusStart` (0-based) on go into a frame marked `data-frame-type="focus"`, which is
 * what collapsed demo code blocks display.
 */
export async function highlightToFramesHast(code, language, focusStart = 0) {
  const root = await highlightToHast(code, language);
  const lines = splitLines(root.children);
  const frames = [];
  if (focusStart > 0) {
    frames.push(frameNode(lines.slice(0, focusStart), 1, null));
  }
  frames.push(frameNode(lines.slice(focusStart), focusStart + 1, 'focus'));
  return { type: 'root', children: frames };
}

export async function highlightToFramesHtml(code, language, focusStart = 0) {
  return toHtml(await highlightToFramesHast(code, language, focusStart));
}
