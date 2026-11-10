"""Shared helper: extracts the exported types after a component (port.transform applied)."""
import re
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
import importlib

port = importlib.import_module('port')
UP = '/tmp/upstream/base-ui/packages/react/src/'


def tail(rel, marker=None):
    s = open(UP + rel).read()
    if marker and marker in s:
        i = s.index(marker)
    else:
        m = re.search(r'^export (interface|type) \w+(State|Props)\b', s, flags=re.M)
        i = m.start()
    t = port.transform(s[i:])
    t = (
        t.replace('React.Ref<', 'RefInput<')
        .replace('React.RefObject<', 'RefObject<')
        .replace('React.ReactNode', 'JSX.Element')
        .replace('React.RefAttributes<HTMLDivElement>', '{ ref?: RefInput<HTMLDivElement> }')
        .replace('React.JSX.Element', 'JSX.Element')
    )
    return re.sub(r'^import .*\n', '', t, flags=re.M)
