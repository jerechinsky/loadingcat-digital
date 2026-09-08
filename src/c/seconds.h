#pragma once
#include <stdint.h>

// Whole-spoke positions advance clockwise from the top over one wall-clock minute.
static inline uint8_t seconds_phase(uint32_t minute_ms,uint8_t count) {
  return count ? ((minute_ms%60000u)*count)/60000u : 0;
}
static inline uint32_t seconds_delay_ms(uint32_t minute_ms,uint8_t count) {
  if(!count)return 60000u;
  minute_ms%=60000u;
  uint32_t next=(seconds_phase(minute_ms,count)+1u)*60000u;
  return (next+count-1u)/count-minute_ms;
}
