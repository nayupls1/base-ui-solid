#!/usr/bin/env python3
"""Mechanical React → Solid conversion for docs demos and docs components.

Usage: convert-demo.py <src> <dest>
Handles imports, attribute names, style objects, `key` props and simple hooks.
Demos that use stateful React hooks still need a manual pass (marked with a TODO comment).
"""
import re
import sys

ATTRS = {
    'className': 'class',
    'htmlFor': 'for',
    'tabIndex': 'tabindex',
    'readOnly': 'readonly',
    'autoComplete': 'autocomplete',
    'autoFocus': 'autofocus',
    'autoCapitalize': 'autocapitalize',
    'autoCorrect': 'autocorrect',
    'spellCheck': 'spellcheck',
    'maxLength': 'maxlength',
    'minLength': 'minlength',
    'colSpan': 'colspan',
    'rowSpan': 'rowspan',
    'enterKeyHint': 'enterkeyhint',
    'inputMode': 'inputmode',
    'crossOrigin': 'crossorigin',
    'referrerPolicy': 'referrerpolicy',
    'srcSet': 'srcset',
    'dateTime': 'datetime',
    'noValidate': 'novalidate',
    'contentEditable': 'contenteditable',
    'accessKey': 'accesskey',
    'strokeWidth': 'stroke-width',
    'strokeLinecap': 'stroke-linecap',
    'strokeLinejoin': 'stroke-linejoin',
    'strokeMiterlimit': 'stroke-miterlimit',
    'strokeDasharray': 'stroke-dasharray',
    'strokeDashoffset': 'stroke-dashoffset',
    'strokeOpacity': 'stroke-opacity',
    'fillRule': 'fill-rule',
    'fillOpacity': 'fill-opacity',
    'clipRule': 'clip-rule',
    'clipPath': 'clip-path',
    'stopColor': 'stop-color',
    'stopOpacity': 'stop-opacity',
    'fontSize': 'font-size',
    'fontWeight': 'font-weight',
    'textAnchor': 'text-anchor',
    'dominantBaseline': 'dominant-baseline',
    'vectorEffect': 'vector-effect',
    'shapeRendering': 'shape-rendering',
    'xlinkHref': 'href',
}


def kebab(name: str) -> str:
    if name.startswith('--'):
        return name
    out = re.sub(r'([A-Z])', lambda m: '-' + m.group(1).lower(), name)
    if out.startswith('webkit-') or out.startswith('moz-') or out.startswith('ms-'):
        out = '-' + out
    return out


def convert_style_object(body: str) -> str:
    def repl(m):
        key = m.group(2)
        quoted = m.group(1) or ''
        if quoted:
            return m.group(0)
        return f"{m.group(0)[:m.start(2) - m.start(0)]}'{kebab(key)}':"
    return re.sub(r"(^|[{,\s])(?<!['\"-])([a-zA-Z][a-zA-Z0-9]*)\s*:(?!:)",
                  lambda m: f"{m.group(1)}'{kebab(m.group(2))}':" if re.search('[A-Z]', m.group(2)) else m.group(0),
                  body)


def convert_hooks(s: str) -> str:
    """Converts the simple React hook patterns demos use. Review the result."""
    imports = set()
    if 'React.useId()' in s:
        s = s.replace('React.useId()', 'createUniqueId()')
        imports.add('createUniqueId')
    signals = []

    def state(m):
        signals.append(m.group(1))
        imports.add('createSignal')
        return f'const [{m.group(1)}, {m.group(2)}] = createSignal{m.group(3) or ""}('

    s = re.sub(r'const \[(\w+), (\w+)\] = React\.useState(<[^\n]*?>)?\(', state, s)
    for name in signals:
        s = re.sub(r'(?<![.\w\[\'"/-])' + name + r'\b(?!\s*[:,]\s*set)(?!\()(?!\s*:)(?![\'"])(?!=(?![=>]))(?<!-)', name + '()', s)
        # undo the declaration
        s = s.replace(f'const [{name}(), ', f'const [{name}, ')

    refs = []

    def use_ref(m):
        refs.append(m.group(1))
        type_arg = m.group(2) or '<any>'
        init = m.group(3) or 'null'
        type_name = type_arg[1:-1]
        if init == 'null' and 'null' not in type_name:
            type_name += ' | null'
        return f'const {m.group(1)}: {{ current: {type_name} }} = {{ current: {init} }};'

    s = re.sub(r'const (\w+) = React\.useRef(<[^\n]*?>)?\(([^)]*)\);', use_ref, s)
    for name in refs:
        # Native elements need callback refs; Base UI components accept ref objects.
        s = re.sub(r'(<[a-z][\w-]*\b[^<>]*?)\bref=\{' + name + r'\}',
                   lambda m: m.group(1) + 'ref={(el) => {\n' + f'          {name}.current = el;\n' + '        }}', s, flags=re.S)

    def effect(m):
        imports.add('onSettled')
        return 'onSettled(() => {' + m.group(1) + '});'

    s = re.sub(r'React\.useEffect\(\(\) => \{(.*?)\n  \}, \[\]\);', lambda m: effect(type('M', (), {'group': lambda self, i: m.group(1) + '\n  '})()), s, flags=re.S)
    if imports:
        s = f"import {{ {', '.join(sorted(imports))} }} from 'solid-js';\n" + s
    return s


def transform(src: str) -> str:
    s = src
    s = s.replace("'use client';\n", '')
    s = re.sub(r"import \* as React from 'react';\n", '', s)
    s = re.sub(r"import React from 'react';\n", '', s)
    s = s.replace("'@base-ui/react/", "'@base-ui-solid/solid/")
    s = s.replace("'@base-ui/react'", "'@base-ui-solid/solid'")
    s = s.replace("'@base-ui/utils/", "'@base-ui-solid/utils/")
    for k, v in ATTRS.items():
        s = re.sub(r'(?<=[\s{(,])' + k + r'(?==)', v, s)
    # style={{ camelCase: ... }}
    s = re.sub(r'style=\{\{(.*?)\}\}', lambda m: 'style={{' + convert_style_object(m.group(1)) + '}}', s, flags=re.S)
    # key props are meaningless in Solid
    s = re.sub(r'\s+key=\{[^{}]*\}', '', s)
    s = re.sub(r'\s+key="[^"]*"', '', s)
    s = s.replace('React.ComponentProps<\'svg\'>', 'JSX.SvgSVGAttributes<SVGSVGElement>')
    s = re.sub(r"React\.ComponentProps<'(\w+)'>", r"JSX.IntrinsicElements['\1']", s)
    s = s.replace('React.ComponentType', 'Component')
    s = s.replace('React.ReactNode', 'JSX.Element')
    s = s.replace('React.CSSProperties', 'JSX.CSSProperties')
    s = s.replace('React.Fragment', '')
    s = s.replace('<>', '<>').replace('</>', '</>')
    s = re.sub(r'React\.(\w+Event)<[^>]*>', r'\1', s)
    # onChange on text inputs is native `change` in Solid; prefer onInput.
    s = re.sub(r'(<(?:input|textarea)\b[^>]*?)\bonChange=', r'\1onInput=', s, flags=re.S)
    s = s.replace('event.nativeEvent', 'event')
    s = convert_hooks(s)
    hooks = re.findall(r'React\.use\w+', s)
    if 'JSX.' in s and 'type JSX' not in s:
        s = "import type { JSX } from '@solidjs/web';\n" + s
    if hooks:
        s = '// TODO(solid-port): uses React hooks: ' + ', '.join(sorted(set(hooks))) + '\n' + s
    return s


if __name__ == '__main__':
    src, dest = sys.argv[1], sys.argv[2]
    with open(src) as f:
        out = transform(f.read())
    import os
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'w') as f:
        f.write(out)
