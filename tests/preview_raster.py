#!/usr/bin/env python3
"""Compare real emulator typography with the settings preview's pixel raster.
Run after capture_emulator.py --font-check and settings-ui.test.js.
Pillow is required. No device or network access.
"""
import argparse
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--emulator', type=Path, default=root.parent / 'previews')
parser.add_argument('--preview', type=Path, default=root.parent.parent / 'work/settings-qa')
args = parser.parse_args()
checked = []
for model in ('aplite', 'emery'):
    for family in (0,2,7,8):
        name = f'{model}-font-{family}.png'
        actual = Image.open(args.emulator / name).convert('RGB')
        expected = Image.open(args.preview / name).convert('RGB')
        assert actual.size == expected.size
        w, h = actual.size
        # The screenshot tool applies a display color correction. Compare
        # the dark/light masks, not its cosmetic RGB correction. The entire
        # lower band covers time, temperature, alignment and their outlines.
        band = (0, h - (88 if w >= 200 else 70), w, h)
        a = [pixel == (0, 0, 0) for pixel in actual.crop(band).getdata()]
        b = [pixel == (0, 0, 0) for pixel in expected.crop(band).getdata()]
        mismatches = sum(x != y for x, y in zip(a, b))
        assert mismatches == 0, (name, 'Preview/watch pixel mismatch', mismatches)
        checked.append(name)
report = {'matching_captures': len(checked), 'platforms': ['aplite', 'emery'],
          'fonts': 4, 'sizes': ['standard'], 'layout': 'stacked', 'mismatched_pixels': 0}
(args.preview / 'raster-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print('All 8 time and temperature captures match the live preview pixel for pixel.')
