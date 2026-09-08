// Host check: clang -std=c11 -Wall -Wextra -Werror tests/spin_math.c -o ../../work/spin-math-check && ../../work/spin-math-check
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include "../src/c/spin.h"

static uint32_t elapsed_for_advances(uint8_t advances, uint8_t segments,
                                     uint8_t setting, uint8_t motion) {
  uint32_t elapsed = 0;
  for (uint8_t step = 0; step < advances; ++step) {
    elapsed += spin_delay_ms(step, segments, setting, motion);
  }
  return elapsed;
}

static void check_run(uint8_t segments, uint8_t setting, uint8_t motion) {
  const uint8_t steps = spin_steps(segments, motion);
  const uint32_t duration = spin_duration_ms(setting);
  assert(steps == (motion == 0 ? segments : 32));

  uint32_t elapsed = 0;
  uint32_t previous_delay = 0;
  for (uint8_t step = 0; step < steps; ++step) {
    const uint32_t delay = spin_delay_ms(step, segments, setting, motion);
    if (motion == 1 && step == 0) {
      assert(delay == 0); // Fast spin makes its first advance immediately.
    } else {
      assert(delay > 0);
      assert(delay >= previous_delay); // Coasting never accelerates again.
      previous_delay = delay;
    }
    elapsed += delay;
    assert(elapsed <= duration);
    if (step + 1 < steps) assert(elapsed < duration);
  }
  assert(elapsed == duration);

  // Any resting phase can receive a clockwise or anticlockwise kick. Every
  // callback advances exactly one adjacent spoke, including wraparound.
  for (int direction = -1; direction <= 1; direction += 2) {
    for (uint8_t start = 0; start < segments; ++start) {
      uint8_t phase = start;
      for (uint8_t step = 0; step < steps; ++step) {
        const uint8_t old_phase = phase;
        phase = (uint8_t)((phase + segments + direction) % segments);
        assert(phase < segments);
        assert(phase != old_phase);
        if (direction == 1) assert((phase + segments - old_phase) % segments == 1);
        else assert((old_phase + segments - phase) % segments == 1);
      }
      const int displacement = (int)steps * direction;
      const uint8_t expected = (uint8_t)((start + displacement % segments + segments) % segments);
      assert(phase == expected);
      if (motion == 0) assert(phase == start); // Exactly one revolution.
    }
  }
}

int main(void) {
  static const uint8_t counts[] = {6, 7, 8, 10, 12};
  static const uint32_t durations[] = {3000, 4000, 2000};
  for (uint8_t setting = 0; setting < 3; ++setting) {
    assert(spin_duration_ms(setting) == durations[setting]);
    for (unsigned i = 0; i < sizeof(counts) / sizeof(counts[0]); ++i) {
      for (uint8_t motion = 0; motion < 2; ++motion) {
        check_run(counts[i], setting, motion);
      }
    }
  }

  // Fixed default traces guard the actual feel, beyond totals that could also
  // pass with an evenly paced or front-loaded sequence.
  static const uint32_t slow_three_seconds[] = {235, 243, 266, 307, 363, 435, 523, 628};
  static const uint32_t fast_three_seconds[] = {
    0, 25, 27, 27, 29, 31, 33, 36, 39, 43, 46, 52, 56, 61, 67, 74,
    80, 86, 95, 102, 110, 119, 128, 138, 147, 158, 169, 180, 192, 203, 217, 230
  };
  for (uint8_t step = 0; step < 8; ++step) {
    assert(spin_delay_ms(step, 8, 0, 0) == slow_three_seconds[step]);
  }
  for (uint8_t step = 0; step < 32; ++step) {
    assert(spin_delay_ms(step, 8, 0, 1) == fast_three_seconds[step]);
  }
  const uint32_t slow_first_advance = spin_delay_ms(0, 8, 0, 0);
  const uint32_t fast_first_scheduled_advance = spin_delay_ms(1, 8, 0, 1);
  assert(slow_first_advance >= 6 * fast_first_scheduled_advance);
  assert(elapsed_for_advances(8, 8, 0, 0) >= 8 * elapsed_for_advances(8, 8, 0, 1));

  puts("Spinner timing passed: 30 count/duration/motion combinations, exact elapsed time, coasting, phase wraparound and distinct slow/fast startup.");
  return 0;
}
