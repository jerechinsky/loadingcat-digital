// Host check: clang -std=c11 -Wall -Wextra -Werror tests/seconds_math.c -o /tmp/loading-cat-seconds-check
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include "../src/c/seconds.h"

typedef struct {
  uint8_t count;
  uint32_t boundaries[13];
} MinuteSchedule;

// First millisecond belonging to each spoke, followed by the next minute.
// Seven spokes deliberately alternate unequal integer durations. Repeating a
// rounded 8571 ms or 8572 ms interval would drift away from these boundaries.
static const MinuteSchedule schedules[] = {
  {6, {0, 10000, 20000, 30000, 40000, 50000, 60000}},
  {7, {0, 8572, 17143, 25715, 34286, 42858, 51429, 60000}},
  {8, {0, 7500, 15000, 22500, 30000, 37500, 45000, 52500, 60000}},
  {10, {0, 6000, 12000, 18000, 24000, 30000, 36000, 42000,
        48000, 54000, 60000}},
  {12, {0, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000}}
};

static void check_millisecond(const MinuteSchedule *schedule, uint32_t ms) {
  const uint32_t position = ms % 60000u;
  uint8_t expected = 0;
  while (position >= schedule->boundaries[expected + 1u]) ++expected;
  const uint32_t next = schedule->boundaries[expected + 1u];
  const uint8_t phase = seconds_phase(ms, schedule->count);
  const uint32_t delay = seconds_delay_ms(ms, schedule->count);
  assert(phase == expected);
  assert(phase < schedule->count);
  assert(delay > 0);
  assert(delay == next - position);
  assert(seconds_phase(position + delay - 1u, schedule->count) == phase);
  assert(seconds_phase(position + delay, schedule->count) ==
         (uint8_t)((phase + 1u) % schedule->count));
}

int main(void) {
  unsigned positions_checked = 0;
  for (unsigned i = 0; i < sizeof(schedules) / sizeof(schedules[0]); ++i) {
    const MinuteSchedule *schedule = &schedules[i];
    for (uint32_t ms = 0; ms < 60000u; ++ms) {
      check_millisecond(schedule, ms);
      check_millisecond(schedule, ms + 60000u);
      check_millisecond(schedule, ms + 3660000u);
      ++positions_checked;
    }
    check_millisecond(schedule, UINT32_MAX);

    // Walk repeated schedules by the requested delay, including the seven-spoke
    // uneven boundaries. Every minute must finish at exactly 60000 ms.
    uint32_t elapsed = 0;
    for (uint32_t minute = 0; minute < 100u; ++minute) {
      assert(seconds_phase(elapsed, schedule->count) == 0);
      for (uint8_t phase = 0; phase < schedule->count; ++phase) {
        assert(elapsed == minute * 60000u + schedule->boundaries[phase]);
        assert(seconds_phase(elapsed, schedule->count) == phase);
        elapsed += seconds_delay_ms(elapsed, schedule->count);
      }
      assert(elapsed == (minute + 1u) * 60000u);
    }
  }
  assert(positions_checked == 300000u);
  puts("Seconds timing passed: every millisecond for all five spoke counts, minute wrap, positive boundary delays and 100 minutes without seven-spoke drift.");
  return 0;
}
