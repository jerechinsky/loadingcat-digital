#pragma once
#include <stdbool.h>

// Local hours, start inclusive and end exclusive. Equal hours mean no pause.
static inline bool night_paused(bool enabled, int start, int end, int hour) {
  if (!enabled || start == end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}
