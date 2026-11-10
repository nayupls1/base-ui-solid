#!/usr/bin/env python3
"""Copies an upstream component docs page (page.mdx, types.md, demos) into the Solid docs.

Usage: convert-docs-page.py <component-slug> [--force]
Demo sources go through convert-demo.py; demos that use React hooks get a TODO header and
need a manual pass. Existing demo files are kept unless --force is given.
"""
import os
import pathlib
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(__file__))
from importlib import import_module

convert_demo = import_module('convert-demo')

UP = pathlib.Path('/tmp/upstream/base-ui/docs/src/app/(docs)/react/components')
DEST = pathlib.Path(__file__).resolve().parent.parent / 'docs/src/pages/components'


def solidify_prose(text: str) -> str:
    text = text.replace('@base-ui/react', 'base-ui-solidjs')
    text = re.sub(r'\]\(/react/components/', '](/solid/components/', text)
    text = re.sub(r'\]\(/react/', '](https://base-ui.com/react/', text)
    text = re.sub(r'href="/react/components/', 'href="/solid/components/', text)
    text = re.sub(r'href="/react/', 'href="https://base-ui.com/react/', text)
    text = text.replace('`className`', '`class`')
    text = re.sub(r'\bReact (component|components|popover|tooltip|dialog|menu|select|element|elements|node|nodes|app|apps|tree|state|code)\b',
                  r'Solid \1', text)
    text = re.sub(r'\b(unstyled|accessible|headless) React\b', r'\1 Solid', text)
    text = text.replace("'React ", "'Solid ").replace('Headless React Components', 'Headless Solid Components')
    return text


def convert_code_block(code: str) -> str:
    out = convert_demo.transform(code)
    # Code snippets in pages are fragments; don't add type imports to them.
    out = out.replace("import type { JSX } from '@solidjs/web';\n", '')
    out = re.sub(r'^// TODO\(solid-port\).*\n', '', out)
    return out


def convert_page(text: str) -> str:
    parts = re.split(r'(^```[^\n]*\n.*?^```$)', text, flags=re.S | re.M)
    result = []
    for part in parts:
        if part.startswith('```'):
            header, _, rest = part.partition('\n')
            body = rest[: rest.rfind('```')]
            result.append(header + '\n' + convert_code_block(body) + '```')
        else:
            result.append(solidify_prose(part))
    return ''.join(result)


def write_types_ts(src_dir: pathlib.Path, dest_dir: pathlib.Path):
    upstream = (src_dir / 'types.ts').read_text()
    exports = re.findall(r'export const (\w+) = (createTypes|types|AdditionalTypes)', upstream)
    lines = [
        "import data from './types.md?types';",
        "import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';",
        '',
    ]
    for name, kind in exports:
        if kind == 'createTypes':
            lines.append(f'export const {name} = createTypes(data);')
        elif kind == 'types':
            lines.append(f'export const {name} = createMultipleTypes(data);')
        else:
            lines.append(f'export const {name} = (_props: Record<string, unknown>) => null;')
    (dest_dir / 'types.ts').write_text('\n'.join(lines) + '\n')


def convert_demos(src_dir: pathlib.Path, dest_dir: pathlib.Path, force: bool):
    demos = src_dir / 'demos'
    if not demos.exists():
        return []
    todo = []
    for path in sorted(demos.rglob('*')):
        if path.is_dir():
            continue
        rel = path.relative_to(demos)
        target = dest_dir / 'demos' / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if path.name == 'index.ts' and len(rel.parts) == 2:
            write_demo_index(path, target)
            continue
        if target.exists() and not force:
            continue
        if path.suffix in ('.tsx', '.ts'):
            source = convert_demo.transform(path.read_text())
            target.write_text(source)
            if source.startswith('// TODO(solid-port)'):
                todo.append(str(target))
        else:
            shutil.copyfile(path, target)
    return todo


SOLID_SRC = pathlib.Path(__file__).resolve().parent.parent / 'packages/solid/src'


def missing_components(demo_dir: pathlib.Path):
    """Base UI modules a demo imports that aren't ported yet."""
    missing = set()
    for file in demo_dir.rglob('*.tsx'):
        for module in re.findall(r"from '@base-ui/react/([\w-]+)'", file.read_text()):
            if not (SOLID_SRC / module / 'index.ts').exists():
                missing.add(module)
    return sorted(missing)


def write_demo_index(src: pathlib.Path, dest: pathlib.Path):
    text = src.read_text()
    name = re.search(r'export const (\w+)', text).group(1)
    missing = missing_components(src.parent)
    if missing:
        dest.write_text(
            "import { createPendingDemo } from 'docs/src/utils/createDemo';\n\n"
            f"export const {name} = createPendingDemo({missing!r});\n".replace("'", "'")
        )
        print('PENDING', dest, missing)
        return
    variants = re.findall(r"import (\w+) from '\./([\w-]+)';", text)
    lines = ["import { createDemoWithVariants } from 'docs/src/utils/createDemo';"]
    for ident, folder in variants:
        lines.append(f"import {ident} from './{folder}';")
        lines.append(f"import {ident}Files from './{folder}/index.tsx?demo-files';")
    slug = src.parent.name
    lines.append('')
    lines.append(f'export const {name} = createDemoWithVariants(')
    lines.append('  {')
    for ident, _ in variants:
        lines.append(f'    {ident}: {{ component: {ident}, files: {ident}Files }},')
    lines.append('  },')
    lines.append(f"  {{ slug: '{slug}' }},")
    lines.append(');')
    dest.write_text('\n'.join(lines) + '\n')


def main():
    slug = sys.argv[1]
    force = '--force' in sys.argv
    src_dir = UP / slug
    dest_dir = DEST / slug
    dest_dir.mkdir(parents=True, exist_ok=True)
    if (src_dir / 'page.mdx').exists():
        (dest_dir / 'page.mdx').write_text(convert_page((src_dir / 'page.mdx').read_text()))
    shutil.copyfile(src_dir / 'types.md', dest_dir / 'types.md')
    write_types_ts(src_dir, dest_dir)
    todo = convert_demos(src_dir, dest_dir, force)
    for path in todo:
        print('TODO', path)


if __name__ == '__main__':
    main()
