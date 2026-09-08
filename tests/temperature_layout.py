#!/usr/bin/env python3
"""Check the native temperature placement against actual shipped glyph pixels.

Compiles only the pure C layout helper on the host. No emulator, font changes or
network access. Optional --output writes the geometry evidence as JSON.
"""
import argparse
import ctypes
import json
import math
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path)
args = parser.parse_args()
fonts = json.loads((root / 'tools/development/preview-assets.json').read_text())['fonts']
subprocess.run(['python3', str(root / 'tools/generate_temperature_metrics.py'), '--check'], check=True)
families, sizes = (0, 2, 7, 8), (22, 18, 16)
characters = '0123456789-°'
models = (('aplite', 144, 168, False), ('basalt', 144, 168, False),
          ('chalk', 180, 180, True), ('diorite', 144, 168, False),
          ('emery', 200, 228, False), ('flint', 144, 168, False),
          ('gabbro', 260, 260, True))
values = [str(value) + '°' for value in range(-148, 159)] + ['--°', '-999°', '999°']


def circle_right(width, height, y):
    remaining = (min(width, height) - 1) ** 2 - (2 * y - height + 1) ** 2
    if remaining < 0:
        return -1
    right = (width - 1 + math.isqrt(remaining)) // 2
    return right if (2 * right - width + 1) ** 2 <= remaining else -1


def in_circle(width, height, x, y):
    return (2 * x - width + 1) ** 2 + (2 * y - height + 1) ** 2 <= (min(width, height) - 1) ** 2


with tempfile.TemporaryDirectory(prefix='loading-cat-temperature-') as temporary:
    directory = Path(temporary)
    wrapper = directory / 'wrapper.c'
    wrapper.write_text('''#include "temperature_layout.h"
int place(const char *text,int family,int size,int width,int height,int y,int box_width,int round) {
  return temperature_box_x(text,family,size,width,height,y,box_width,round);
}
int chord(int width,int height,int y) { return temperature_circle_right(width,height,y); }
int metric(int family,int size,int glyph,int field) {
  const TemperatureGlyph *g=&temperature_glyphs(family,size)[glyph];
  return field==0?g->advance:(field==1?g->left:(field==2?g->right:(field==3?g->top:g->bottom)));
}
''')
    library = directory / 'layout.dylib'
    subprocess.run(['clang', '-std=c11', '-Wall', '-Wextra', '-Werror', '-shared', '-fPIC',
                    '-I', str(root / 'src/c'), str(wrapper), '-o', str(library)], check=True)
    native = ctypes.CDLL(str(library))
    native.place.argtypes = [ctypes.c_char_p] + [ctypes.c_int] * 7
    native.place.restype = native.chord.restype = native.metric.restype = ctypes.c_int
    for _, width, height, round_model in models:
        if round_model:
            for y in range(-1, height + 1):
                assert native.chord(width, height, y) == circle_right(width, height, y), (width, y)

    rasters = {}
    for family in families:
        for size in sizes:
            glyphs = fonts[f'n{family}-{size}']['glyphs']
            for index, character in enumerate(characters):
                glyph = glyphs[character]
                points = [(glyph['x'] + x, glyph['y'] + y)
                          for y, row in enumerate(glyph['rows'])
                          for x, value in enumerate(row) if value == '1']
                xs, ys = zip(*points)
                bounds = (min(xs), max(xs), min(ys), max(ys))
                assert [native.metric(family, size, index, field) for field in range(5)] == [glyph['advance'], *bounds]
                # Dilation is exactly the existing eight-offset black outline.
                outline = {(x + dx, y + dy) for x, y in points for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
                rasters[family, size, character] = (glyph['advance'], bounds, outline)

    rectangles = rounds = clamped = fallback_cases = 0
    examples = []
    for family in families:
        for size in sizes:
            for model, width, height, round_model in models:
                big = width >= 200
                margin = (42 if big else 30) if round_model else (5 if big else 4)
                y = height - margin - size
                for text in values:
                    glyphs = [rasters[family, size, char] for char in text]
                    total_advance = sum(glyph[0] for glyph in glyphs)
                    # Widen the host test's box for artificial font/model pairs;
                    # actual rendering picks the smaller font before placement.
                    box_width = max(63 if big else 48, total_advance)
                    x = native.place(text.encode(), family, size, width, height, y, box_width, round_model)
                    degree_advance, degree_bounds, _ = glyphs[-1]
                    last_advance, last_bounds, _ = glyphs[-2]
                    gap = last_advance + degree_bounds[0] - last_bounds[1] - 1
                    assert gap >= 1
                    degree_right = x + box_width - degree_advance + degree_bounds[1]
                    edge = min(circle_right(width, height, y + degree_bounds[2]),
                               circle_right(width, height, y + degree_bounds[3])) if round_model else width - 1
                    target_x = edge - gap - (box_width - degree_advance + degree_bounds[1])
                    assert edge - degree_right >= gap
                    if not round_model:
                        assert edge - degree_right == gap, (model, family, size, text)
                        rectangles += 1
                    else:
                        rounds += 1
                        clamped += x < target_x
                    pen = x + box_width - total_advance
                    next_step_clips_bbox = False
                    for advance, bounds, outline in glyphs:
                        for px, py in outline:
                            screen_x, screen_y = pen + px, y + py
                            assert 0 <= screen_x < width and 0 <= screen_y < height, (model, family, size, text, screen_x, screen_y)
                            if round_model:
                                assert in_circle(width, height, screen_x, screen_y), (model, family, size, text, screen_x, screen_y)
                        if round_model:
                            for px in (bounds[0] - 1, bounds[1] + 1):
                                for py in (bounds[2] - 1, bounds[3] + 1):
                                    assert in_circle(width, height, pen + px, y + py)
                                    if not in_circle(width, height, pen + px + 1, y + py):
                                        next_step_clips_bbox = True
                        pen += advance
                    if round_model and x < target_x:
                        assert next_step_clips_bbox, (model, family, size, text, 'Not the closest safe placement')
                    if family == 2 and size == (22 if big else 18) and text in ('22°', '31°'):
                        old_inset = (43 if big else 26) if round_model else (8 if big else 5)
                        old_x = width - old_inset - box_width + (2 if big else 1)
                        examples.append({'platform': model, 'text': text, 'font_size': size,
                                         'old_box_x': old_x, 'new_box_x': x, 'shift_right_px': x - old_x,
                                         'digit_to_degree_gap_px': gap, 'degree_to_edge_gap_px': edge - degree_right})

    # Exercise the native smaller-font branch using deliberately narrow boxes.
    # Its unchanged Y adjustment must use the selected font's actual ink bounds.
    for family in families:
        for initial, fallback in ((22, 18), (18, 16)):
            text = '-148°'
            large_width = sum(rasters[family, initial, c][0] for c in text)
            small_width = sum(rasters[family, fallback, c][0] for c in text)
            assert small_width < large_width
            box_width = small_width
            actual_size = fallback if large_width > box_width else initial
            initial_y = 228 - 5 - initial
            adjusted_y = initial_y + initial - actual_size
            assert adjusted_y == 228 - 5 - fallback
            x = native.place(text.encode(), family, actual_size, 200, 228, adjusted_y, box_width, False)
            degree = rasters[family, fallback, '°']
            last = rasters[family, fallback, '8']
            gap = last[0] + degree[1][0] - last[1][1] - 1
            assert 199 - (x + box_width - degree[0] + degree[1][1]) == gap
            fallback_cases += 1

report = {'fonts': len(families), 'font_sizes': list(sizes), 'glyphs_verified': len(rasters),
          'platforms': [model[0] for model in models], 'readings_per_font_size_platform': len(values),
          'rectangular_exact_gap_cases': rectangles, 'round_safe_cases': rounds,
          'round_conservative_clamp_cases': clamped, 'fallback_font_cases': fallback_cases,
          'outline_clipped_pixels': 0, 'examples': examples}
if args.output:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
print(f'Temperature layout passed: {rectangles} exact rectangular gaps, {rounds} safe round placements, all 144 glyph metrics and {fallback_cases} fallback-font cases.')
