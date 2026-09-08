#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "temperature_metrics.h"

// Temperature strings contain digits, minus signs and a final UTF-8 degree.
static inline int temperature_next_glyph(const char **cursor) {
  unsigned char value = (unsigned char)*(*cursor)++;
  if (value >= '0' && value <= '9') return value - '0';
  if (value == '-') return 10;
  if (value == 0xc2 && (unsigned char)**cursor == 0xb0) {
    ++*cursor;
    return 11;
  }
  return -1;
}

// Pixel centers within an inscribed circle; doubled coordinates avoid floats.
static inline int temperature_circle_right(int width, int height, int y) {
  int diameter = (width < height ? width : height) - 1;
  int dy = 2 * y - (height - 1);
  int32_t remaining = diameter * diameter - dy * dy;
  if (remaining < 0) return -1;
  int left = width / 2, right = width - 1;
  int center_dx = 2 * left - (width - 1);
  if (center_dx * center_dx > remaining) return -1;
  while (left < right) {
    int candidate = (left + right + 1) / 2;
    int dx = 2 * candidate - (width - 1);
    if (dx * dx <= remaining) left = candidate;
    else right = candidate - 1;
  }
  return left;
}

static inline int temperature_min(int a, int b) { return a < b ? a : b; }
static inline int temperature_max(int a, int b) { return a > b ? a : b; }

// Return the GTextAlignmentRight box X, preserving its width, font and Y.
// Match the blank columns after the final digit to those after the degree.
// Round screens clamp each glyph's bounding box plus its existing 1px outline.
static inline int temperature_box_x(const char *text, int family, int font_size,
                                    int width, int height, int box_y,
                                    int box_width, bool round) {
  const TemperatureGlyph *glyphs = temperature_glyphs(family, font_size);
  const TemperatureGlyph *degree = &glyphs[11];
  int advance = 0, last_number = 10;
  for (const char *cursor = text; *cursor;) {
    int index = temperature_next_glyph(&cursor);
    if (index < 0) continue;
    advance += glyphs[index].advance;
    if (index != 11) last_number = index;
  }
  int gap = glyphs[last_number].advance + degree->left - glyphs[last_number].right - 1;
  int edge = width - 1;
  if (round) {
    edge = temperature_min(temperature_circle_right(width, height, box_y + degree->top),
                           temperature_circle_right(width, height, box_y + degree->bottom));
  }
  int degree_right = box_width - degree->advance + degree->right;
  int x = edge - gap - degree_right;
  if (!round) return x;

  int minimum_x = -width, maximum_x = width;
  int pen = box_width - advance;
  for (const char *cursor = text; *cursor;) {
    int index = temperature_next_glyph(&cursor);
    if (index < 0) continue;
    const TemperatureGlyph *glyph = &glyphs[index];
    int right = temperature_min(temperature_circle_right(width, height, box_y + glyph->top - 1),
                               temperature_circle_right(width, height, box_y + glyph->bottom + 1));
    int left = width - 1 - right;
    minimum_x = temperature_max(minimum_x, left - (pen + glyph->left - 1));
    maximum_x = temperature_min(maximum_x, right - (pen + glyph->right + 1));
    pen += glyph->advance;
  }
  return temperature_max(minimum_x, temperature_min(x, maximum_x));
}
