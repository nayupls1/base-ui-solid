#!/usr/bin/env python3
"""Appends upstream's exported types (with JSDoc) to a hand-written Solid component file.
Usage: append-types.py <upstream-rel> [<dest-rel>]"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import port
rel = sys.argv[1]
dest = port.DEST / (sys.argv[2] if len(sys.argv) > 2 else rel)
tail = port.types_tail(rel)
body = dest.read_text()
if 'JSX.' in tail and 'JSX }' not in body and 'JSX,' not in body:
    body = "import type { JSX } from '@solidjs/web';\n" + body
if 'RefInput<' in tail and 'RefInput' not in body.split('\n\n')[0] and 'type RefInput' not in body:
    body = "import type { RefInput } from '" + '../' * (len(pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else rel).parts) - 1) + "internals/useRenderElement';\n" + body
if 'RefObject<' in tail and 'RefObject' not in body.split('export function')[0]:
    body = "import type { RefObject } from 'base-ui-solidjs-utils/types';\n" + body
content = body.rstrip('\n') + '\n\n' + tail.lstrip('\n')
dest.write_text(content)
print(dest)

# Remove later duplicates of top-level function declarations (helpers that were already copied).
import re as _re
text = dest.read_text()
lines = text.split('\n')
seen = set()
out = []
skip_until_close = False
for line in lines:
    if skip_until_close:
        if line == '}':
            skip_until_close = False
        continue
    m = _re.match(r'^function (\w+)', line)
    if m:
        if m.group(1) in seen:
            skip_until_close = True
            # drop preceding JSDoc block
            while out and (out[-1].strip().startswith('*') or out[-1].strip().startswith('/**') or out[-1].strip().startswith('//')):
                out.pop()
            continue
        seen.add(m.group(1))
    out.append(line)
dest.write_text('\n'.join(out))
