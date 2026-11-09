#!/usr/bin/env python3
"""Inserts `props = ownedProps(props)` at the start of every component function (idempotent)."""
import os, pathlib, re, sys
root = pathlib.Path(__file__).resolve().parent.parent / 'packages/solid/src'
pattern = re.compile(r'((?:export )?function [A-Z]\w*(?:<[^>()]*>)?\(\s*(componentProps|props)\s*:[^)]*\)[^{]*\{\n)')
files = sys.argv[1:] or [str(p) for p in root.rglob('*.tsx')]
for f in files:
    p = pathlib.Path(f)
    s = p.read_text()
    changed = False
    def repl(m):
        global changed
        name = m.group(2)
        after = s[m.end():m.end() + 200]
        if f'{name} = ownedProps({name})' in after:
            return m.group(1)
        return m.group(1) + f'  {name} = ownedProps({name});\n'
    new = pattern.sub(repl, s)
    if new != s:
        rel = os.path.relpath(root / 'internals/ownedProps', p.parent)
        if not rel.startswith('.'):
            rel = './' + rel
        if 'ownedProps' not in s:
            # insert import after the last import line
            lines = new.split('\n')
            last_import = 0
            for i, line in enumerate(lines):
                if line.startswith('import ') or (line.startswith('} from ') and i > 0):
                    last_import = i
            lines.insert(last_import + 1, f"import {{ ownedProps }} from '{rel}';")
            new = '\n'.join(lines)
        p.write_text(new)
        print('updated', p.relative_to(root))
