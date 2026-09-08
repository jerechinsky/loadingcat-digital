#pragma once
#include <stdint.h>
#define SPIN_FAST_STEPS 32

static inline uint8_t spin_steps(uint8_t segments, uint8_t motion) {
  return motion == 1 ? SPIN_FAST_STEPS : segments;
}

// Keep the former three-second choice (0) at three seconds for existing users.
static inline uint32_t spin_duration_ms(uint8_t setting) {
  return setting == 1 ? 4000u : (setting == 2 ? 2000u : 3000u);
}

static inline uint32_t spin_weight(uint8_t step, uint8_t steps, uint8_t motion) {
  uint32_t denominator = (steps - 1u) * (steps - 1u);
  return motion == 1 ? 45u + 355u * step * step / denominator
                     : 300u + 500u * step * step / denominator;
}

// Normalize the complete coast to the chosen duration. Slow loading waits before
// every advance; Fast spin preserves the original immediate kick and 32 advances.
// Cumulative boundaries prevent rounding error from shortening the whole spin.
static inline uint32_t spin_delay_ms(uint8_t step, uint8_t segments,
                                     uint8_t setting, uint8_t motion) {
  uint8_t steps = spin_steps(segments, motion);
  uint8_t first = motion == 1 ? 1 : 0;
  if (steps < 2 || step < first || step >= steps) return 0;
  uint32_t total = 0, before = 0;
  for (uint8_t i = first; i < steps; ++i) {
    uint32_t weight = spin_weight(i, steps, motion);
    total += weight;
    if (i < step) before += weight;
  }
  uint32_t after = before + spin_weight(step, steps, motion);
  uint32_t duration = spin_duration_ms(setting);
  return duration * after / total - duration * before / total;
}
