#!/usr/bin/env python3
"""Mechanical first pass for porting a Base UI React source file to Solid.

Usage: port.py <upstream-relative-path> [<dest-relative-path>]
Paths are relative to packages/react/src (upstream) and packages/solid/src (dest).
Prints the destination path. The result still needs a manual pass.
"""
import pathlib
import re
import sys

UP = pathlib.Path('/tmp/upstream/base-ui/packages/react/src')
DEST = pathlib.Path(__file__).resolve().parent.parent / 'packages/solid/src'

EVENT_TYPES = {
    'KeyboardEvent': 'KeyboardEvent',
    'MouseEvent': 'MouseEvent',
    'PointerEvent': 'PointerEvent',
    'FocusEvent': 'FocusEvent',
    'TouchEvent': 'TouchEvent',
    'WheelEvent': 'WheelEvent',
    'ChangeEvent': 'Event',
    'FormEvent': 'Event',
    'SyntheticEvent': 'Event',
    'UIEvent': 'UIEvent',
    'DragEvent': 'DragEvent',
    'ClipboardEvent': 'ClipboardEvent',
    'CompositionEvent': 'CompositionEvent',
    'AnimationEvent': 'AnimationEvent',
    'TransitionEvent': 'TransitionEvent',
    'InputEvent': 'InputEvent',
}


def transform(src: str) -> str:
    s = src
    s = s.replace("'use client';\n", '')
    s = s.replace('@base-ui/utils/', 'base-ui-solidjs-utils/')
    s = s.replace("'@base-ui/react/", "'base-ui-solidjs/")
    s = re.sub(r"import type \* as React from 'react';\n", '', s)
    if 'React.createContext' not in s:
        s = re.sub(r"import \* as React from 'react';\n", '', s)
    s = re.sub(r"import \* as ReactDOM from 'react-dom';\n", '', s)
    for k, v in EVENT_TYPES.items():
        s = re.sub(r'React\.' + k + r'(<[^<>]*(?:<[^<>]*>[^<>]*)*>)?', v, s)
    s = re.sub(r'React\.createRef<([^>]+)>\(\)', r'{ current: null } as RefObject<\1 | null>', s)
    s = re.sub(r'React\.RefObject<', 'RefObject<', s)
    s = re.sub(r'React\.MutableRefObject<', 'RefObject<', s)
    s = re.sub(r'React\.Dispatch<React\.SetStateAction<(.+?)>>', r'(value: \1 | ((prev: \1) => \1)) => void', s)
    s = re.sub(r"React\.ComponentPropsWithRef<'(\w+)'>", r"JSX.IntrinsicElements['\1']", s)
    s = s.replace('React.CSSProperties', 'JSX.CSSProperties')
    s = s.replace('React.ReactNode', 'JSX.Element')
    s = s.replace('React.ReactElement', 'JSX.Element')
    s = s.replace('React.JSX.IntrinsicElements', 'JSX.IntrinsicElements')
    s = s.replace('React.HTMLAttributes', 'JSX.HTMLAttributes')
    s = s.replace('React.AriaRole', 'string')
    s = s.replace('event.nativeEvent', 'event')
    s = s.replace('.nativeEvent', '')
    s = s.replace("from '@floating-ui/react-dom'", "from '@floating-ui/dom'")
    s = s.replace('tabIndex', 'tabindex')
    s = s.replace("'base-ui-solidjs-utils/useIsoLayoutEffect'", "'solid-js' /* TODO useIsoLayoutEffect */")
    if 'RefObject<' in s and 'type RefObject' not in s:
        s = "import type { RefObject } from 'base-ui-solidjs-utils/types';\n" + s
    if 'JSX.' in s and "type JSX" not in s:
        s = "import type { JSX } from '@solidjs/web';\n" + s
    return s


def transform_context(s: str) -> str:
    """React context modules → Solid (`null` means "no provider")."""
    if 'React.createContext' not in s:
        return s
    s = re.sub(r'React\.createContext<(.+?) \| undefined>\(\s*undefined,?\s*\)', r'createContext<\1 | null>(null)', s, flags=re.S)
    s = s.replace('React.createContext', 'createContext').replace('React.useContext(', 'useContext(')
    s = re.sub(r'(\w+) === undefined', r'\1 == null', s)
    s = re.sub(r'return (context|value|store);\n', r'return \1 ?? undefined;\n', s)
    s = s.replace("import * as React from 'react';\n", '')
    s = "import { createContext, useContext } from 'solid-js';\n" + s
    return s


def main():
    rel = sys.argv[1]
    dest_rel = sys.argv[2] if len(sys.argv) > 2 else rel
    src = (UP / rel).read_text()
    out = transform_context(transform(src))
    dest = DEST / dest_rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out)
    print(dest)


if __name__ == '__main__':
    main()


def types_tail(rel: str) -> str:
    """Returns the exported interfaces/types/namespaces after the component definition."""
    src = (UP / rel).read_text()
    lines = src.split('\n')
    start = None
    depth_started = False
    for i, line in enumerate(lines):
        if re.match(r'^export (interface|type|namespace) ', line) and i > 0:
            # find the start of a leading JSDoc block
            j = i
            while j > 0 and (lines[j - 1].strip().startswith('*') or lines[j - 1].strip().startswith('/**')):
                j -= 1
            # only accept if this is after the main component (heuristic: after a line starting with '}' or ')')
            if any(l.startswith(('})', '}) as', '});', '}')) for l in lines[:j]):
                start = j
                break
    if start is None:
        return ''
    tail = '\n'.join(lines[start:])
    tail = transform(tail)
    tail = re.sub(r'^import .*\n', '', tail, flags=re.M)
    tail = tail.replace('React.Ref<', 'RefInput<')
    tail = re.sub(r'React\.ComponentPropsWithRef<\'(\w+)\'>', r"JSX.IntrinsicElements['\1']", tail)
    tail = re.sub(r"React\.ComponentProps<'(\w+)'>\['(\w+)'\]", r"JSX.IntrinsicElements['\1']['\2']", tail)
    tail = tail.replace("'className'", "'class'")
    return tail
