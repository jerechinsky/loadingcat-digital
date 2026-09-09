#pragma once
#include <pebble.h>
#include <stddef.h>

typedef struct {
  int32_t show_spinner, spokes, animate, flick_trigger, light_trigger, spin_length;
  int32_t time_format, leading_zero;
  int32_t numeral_font, spin_motion;
  int32_t weather_location, show_weather, fahrenheit, weather_interval, gray_nose, second_hand;
  int32_t night_pause, night_start, night_end, disconnect_vibe, disconnect_pattern, disconnect_ignore_quiet, disconnect_invert;
  int32_t reconnect_vibe, reconnect_pattern;
} Settings;

typedef struct { const uint32_t *key; size_t offset; int32_t min, max; } SettingBinding;
#define BIND(key, member, min, max) {&key, offsetof(Settings, member), min, max}
static const SettingBinding SETTINGS_BINDINGS[] = {
  BIND(MESSAGE_KEY_RECONNECT_VIBE,reconnect_vibe,0,1),
  BIND(MESSAGE_KEY_RECONNECT_PATTERN,reconnect_pattern,0,3),
  BIND(MESSAGE_KEY_WEATHER_LOCATION_ID,weather_location,0,INT32_MAX),
  BIND(MESSAGE_KEY_DISCONNECT_INVERT,disconnect_invert,0,1),
  BIND(MESSAGE_KEY_DISCONNECT_VIBE,disconnect_vibe,0,1),
  BIND(MESSAGE_KEY_DISCONNECT_PATTERN,disconnect_pattern,0,3),
  BIND(MESSAGE_KEY_DISCONNECT_IGNORE_QUIET,disconnect_ignore_quiet,0,1),
  BIND(MESSAGE_KEY_NIGHT_PAUSE,night_pause,0,1),
  BIND(MESSAGE_KEY_NIGHT_START,night_start,0,23),
  BIND(MESSAGE_KEY_NIGHT_END,night_end,0,23),
  BIND(MESSAGE_KEY_SECOND_HAND,second_hand,0,1),
  BIND(MESSAGE_KEY_GRAY_NOSE,gray_nose,0,1),
  BIND(MESSAGE_KEY_NUMERAL_FONT,numeral_font,0,8),
  BIND(MESSAGE_KEY_SHOW_SPINNER,show_spinner,0,1), BIND(MESSAGE_KEY_SPOKES,spokes,6,12),
  BIND(MESSAGE_KEY_ANIMATE,animate,0,1), BIND(MESSAGE_KEY_FLICK_TRIGGER,flick_trigger,0,1), BIND(MESSAGE_KEY_LIGHT_TRIGGER,light_trigger,0,1),
  BIND(MESSAGE_KEY_SPIN_LENGTH,spin_length,0,2), BIND(MESSAGE_KEY_SPIN_MOTION,spin_motion,0,1), BIND(MESSAGE_KEY_TIME_FORMAT,time_format,0,2),
  BIND(MESSAGE_KEY_LEADING_ZERO,leading_zero,0,1),
  BIND(MESSAGE_KEY_SHOW_WEATHER,show_weather,0,1),
  BIND(MESSAGE_KEY_FAHRENHEIT,fahrenheit,0,1), BIND(MESSAGE_KEY_WEATHER_INTERVAL,weather_interval,15,60)
};
#undef BIND

static bool setting_valid(const SettingBinding *b, int32_t value) {
  if (value < b->min || value > b->max) return false;
  if (*b->key == MESSAGE_KEY_NUMERAL_FONT) return value == 0 || value == 2 || value == 7 || value == 8;
  if (*b->key == MESSAGE_KEY_SPOKES) return value == 6 || value == 7 || value == 8 || value == 10 || value == 12;
  if (*b->key == MESSAGE_KEY_WEATHER_INTERVAL) return value == 15 || value == 30 || value == 60;
  return true;
}

static void settings_load(Settings *settings) {
  *settings = (Settings){.numeral_font=2,.show_spinner=1,.animate=1,.flick_trigger=1,.light_trigger=1,
    .spin_length=0,.spin_motion=1,.spokes=8,.leading_zero=1,.show_weather=1,.weather_interval=30,.gray_nose=1,.second_hand=1,.night_pause=0,.night_start=22,.night_end=7,.disconnect_pattern=2};
  for (size_t i=0; i<ARRAY_LENGTH(SETTINGS_BINDINGS); ++i) {
    const SettingBinding *b = &SETTINGS_BINDINGS[i];
    if (persist_exists(*b->key)) {
      int32_t value = persist_read_int(*b->key);
      if (setting_valid(b,value)) *(int32_t *)((uint8_t *)settings+b->offset) = value;
    }
  }
}

static bool settings_receive(Settings *settings, DictionaryIterator *iter) {
  bool changed = false;
  for (size_t i=0; i<ARRAY_LENGTH(SETTINGS_BINDINGS); ++i) {
    const SettingBinding *b = &SETTINGS_BINDINGS[i];
    Tuple *t = dict_find(iter,*b->key);
    if (!t || t->length != 4 || (t->type != TUPLE_INT && t->type != TUPLE_UINT)) continue;
    int32_t value = t->value->int32;
    int32_t *slot = (int32_t *)((uint8_t *)settings+b->offset);
    if (setting_valid(b,value) && *slot != value) {
      *slot = value;
      persist_write_int(*b->key,value);
      changed = true;
    }
  }
  return changed;
}
