#!/usr/bin/env python3
"""QEMU adapter for unattended watchface captures; no desktop window or audio."""
import os
import sys
from pathlib import Path

binary = Path(os.environ['PEBBLE_QEMU_REAL'])
args = sys.argv[1:]
if '-display' in args:
    args[args.index('-display') + 1] = 'none'
else:
    args += ['-display', 'none']
if '-audio' in args:
    args[args.index('-audio') + 1] = 'driver=none,id=audio0'
if sys.platform == 'darwin':
    os.environ['DYLD_LIBRARY_PATH'] = str(binary.parent.parent / 'lib')
os.execv(str(binary), [str(binary)] + args)
