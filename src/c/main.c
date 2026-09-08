#include <pebble.h>
#include "spin.h"
#include "seconds.h"
#include "night.h"
#include "spinner_geometry.h"
#include "nose.h"
#include "settings.h"
#include "font_metrics.h"
#include "temperature_layout.h"

#define SPINNER_X PBL_PLATFORM_SWITCH(PBL_PLATFORM_TYPE_CURRENT, 66, 66, 82, 66, 90, 66, 119)
#define SPINNER_Y PBL_PLATFORM_SWITCH(PBL_PLATFORM_TYPE_CURRENT, 49, 49, 56, 49, 67, 49, 81)
#define SPINNER_SCALE PBL_PLATFORM_SWITCH(PBL_PLATFORM_TYPE_CURRENT, 74, 74, 85, 74, 100, 74, 132)
#define WEATHER_MAX_AGE (2 * 60 * 60)
#define WEATHER_CACHE_KEY 20
#define WEATHER_TIME_KEY 21
#define WEATHER_RETRY_SECONDS (5 * 60)

static Window *s_window;
static Layer *s_canvas;
static GBitmap *s_background;
static GFont s_temperature_font, s_small_temperature_font, s_stack_font;
static Settings s_settings;
static AppTimer *s_spin_timer, *s_seconds_timer;
static uint8_t s_phase, s_step;
static int8_t s_direction = 1;
static time_t s_last_weather_request;
static int32_t s_temperature, s_weather_time;
static bool s_has_weather, s_js_ready, s_focused, s_spinning;

static uint32_t s_last_kick;
static bool s_phone_connected;

static uint32_t now_ms(void) {
  time_t seconds;
  uint16_t ms;
  time_ms(&seconds, &ms);
  return (uint32_t)seconds * 1000u + ms;
}

static void redraw(void) {
  if (s_canvas) layer_mark_dirty(s_canvas);
}

static void stop_seconds(void) {
  if(s_seconds_timer){app_timer_cancel(s_seconds_timer);s_seconds_timer=NULL;}
}

static uint32_t minute_ms(void) {
  time_t seconds; uint16_t ms;
  time_ms(&seconds,&ms);
  return (uint32_t)(seconds%60)*1000u+ms;
}

static bool animation_paused_now(void) {
  if (!s_settings.night_pause) return false;
  time_t seconds; uint16_t ms;
  time_ms(&seconds, &ms);
  struct tm *local = localtime(&seconds);
  return local && night_paused(true, s_settings.night_start, s_settings.night_end, local->tm_hour);
}

static void stop_spin(void) {
  s_spinning=false;
  if (s_spin_timer) {
    app_timer_cancel(s_spin_timer);
    s_spin_timer = NULL;
  }
}

static int segment_count(void) {
  return s_settings.spokes;
}

static void sync_seconds(void);
static void seconds_tick(void *context) {
  (void)context;
  s_seconds_timer=NULL;
  sync_seconds();
}

static void sync_seconds(void) {
  stop_seconds();
  if(!s_focused || !s_settings.show_spinner || !s_settings.second_hand || s_spinning)return;
  uint32_t ms=minute_ms();
  uint8_t phase=seconds_phase(ms,segment_count());
  bool changed=s_phase!=phase || s_direction!=1;
  s_phase=phase;s_direction=1;
  if(changed)redraw();
  // Sleep until the next spoke boundary, then re-read the wall clock to avoid drift.
  s_seconds_timer=app_timer_register(seconds_delay_ms(ms,segment_count()),seconds_tick,NULL);
}

static void spin_tick(void *context) {
  (void)context;
  s_spin_timer = NULL;
  if(!s_spinning)return;
  if(animation_paused_now()) {stop_spin(); sync_seconds(); redraw(); return;}
  s_phase = (s_phase + segment_count() + s_direction) % segment_count();
  redraw();
  if (++s_step < spin_steps(segment_count(), s_settings.spin_motion)) {
    s_spin_timer = app_timer_register(spin_delay_ms(s_step, segment_count(), s_settings.spin_length, s_settings.spin_motion), spin_tick, NULL);
  } else {
    s_spinning=false;
    APP_LOG(APP_LOG_LEVEL_INFO, "Spin stopped at phase %d", s_phase);
    sync_seconds();
  }
}

static void kick_spin(int8_t direction) {
  if (!s_focused || !s_settings.show_spinner || !s_settings.animate || animation_paused_now()) return;
  uint32_t now = now_ms();
  // One flick can emit several taps and a backlight event. Treat them as one kick.
  if (s_last_kick && now - s_last_kick < 650) return;
  s_last_kick = now;
  // Every kick, including a repeated flick, starts from the live seconds position.
  if(s_settings.second_hand)s_phase=seconds_phase(minute_ms(),segment_count());
  stop_seconds();
  stop_spin();
  s_spinning=true;
  s_direction = direction < 0 ? -1 : 1;
  s_step = 0;
  redraw();
  APP_LOG(APP_LOG_LEVEL_INFO, "Spin started");
  uint32_t delay = spin_delay_ms(0, segment_count(), s_settings.spin_length, s_settings.spin_motion);
  if (delay) s_spin_timer = app_timer_register(delay, spin_tick, NULL);
  else spin_tick(NULL);
}

static void tap_handler(AccelAxisType axis, int32_t direction) {
  (void)axis;
  if (s_settings.flick_trigger) kick_spin(direction);
}

#ifdef _PBL_API_EXISTS_backlight_service_subscribe
static void backlight_handler(bool on) {
  if (on && s_settings.light_trigger) kick_spin(1);
}
#endif

static void focus_handler(bool focused) {
  s_focused = focused;
  if(!focused){stop_spin();stop_seconds();}
  else{sync_seconds();redraw();}
  // Regaining focus restores clock position without starting a coasting spin.
}

static int scaled(int value) {
  return (value * SPINNER_SCALE + 50) / 100;
}

static int background_shift(void) {
  return PBL_IF_ROUND_ELSE(PBL_DISPLAY_WIDTH >= 200 ? 48 : 34, 7);
}

static void draw_spinner(GContext *ctx) {
  GPoint center = GPoint(SPINNER_X+background_shift(),SPINNER_Y);
  int count=segment_count(),width=scaled(4),inner=scaled(15);
  if(width<2)width=2;
  int radius=width/2;
  graphics_context_set_antialiased(ctx,false);
  graphics_context_set_stroke_width(ctx,1);
  for(int i=0;i<count;++i) {
    int bucket=spinner_bucket(s_phase,i,s_direction,count);
    int outer=inner+scaled(spinner_length(bucket));
    int brightness=spinner_brightness(bucket);
    const int16_t *vector=spinner_vector(count,i);
    int ax=center.x+vector[0]*inner/1000,ay=center.y+vector[1]*inner/1000;
    int bx=center.x+vector[0]*outer/1000,by=center.y+vector[1]*outer/1000;
    int left=(ax<bx?ax:bx)-radius,right=(ax>bx?ax:bx)+radius;
    int top=(ay<by?ay:by)-radius,bottom=(ay>by?ay:by)+radius;
#ifdef PBL_COLOR
    graphics_context_set_stroke_color(ctx,GColorFromRGB(brightness,brightness,brightness));
#endif
    for(int y=top;y<=bottom;++y)for(int x=left;x<=right;++x) {
      if(!spinner_contains(x,y,ax,ay,bx,by,radius))continue;
#ifdef PBL_BW
      graphics_context_set_stroke_color(ctx,spinner_dither(x,y,brightness)?GColorWhite:GColorBlack);
#endif
      graphics_draw_pixel(ctx,GPoint(x,y));
    }
  }
}

static bool weather_is_fresh(time_t now) {
  return s_has_weather && s_weather_time > 0 && now >= s_weather_time &&
         now - s_weather_time <= WEATHER_MAX_AGE;
}

static void outlined_text_color(GContext *ctx, const char *text, GFont font, GRect box,
                                GTextAlignment alignment, GColor foreground, GColor outline) {
  graphics_context_set_text_color(ctx, outline);
  for (int dx = -1; dx <= 1; ++dx) {
    for (int dy = -1; dy <= 1; ++dy) {
      if (!dx && !dy) continue;
      GRect shadow = box;
      shadow.origin.x += dx;
      shadow.origin.y += dy;
      graphics_draw_text(ctx, text, font, shadow, GTextOverflowModeFill, alignment, NULL);
    }
  }
  graphics_context_set_text_color(ctx, foreground);
  graphics_draw_text(ctx, text, font, box, GTextOverflowModeFill, alignment, NULL);
}

static void canvas_update(Layer *layer, GContext *ctx) {
  GRect bounds = layer_get_bounds(layer);
  GColor cream = PBL_IF_COLOR_ELSE(GColorFromRGB(255,255,170),GColorWhite);
  graphics_context_set_fill_color(ctx, cream);
  graphics_fill_rect(ctx,bounds,0,GCornerNone);
  GRect background_rect = bounds;
  background_rect.origin.x += background_shift();
  if (s_background) graphics_draw_bitmap_in_rect(ctx, s_background, background_rect);
#ifdef PBL_BW
  if (s_settings.gray_nose) draw_gray_nose(ctx,background_shift());
#endif
  if (s_settings.show_spinner) draw_spinner(ctx);

  time_t now = time(NULL);
  struct tm *local = localtime(&now);
  char hours[3] = "--", minutes[3] = "--";
  if (local) {
    bool twenty_four = s_settings.time_format == 2 || (s_settings.time_format == 0 && clock_is_24h_style());
    strftime(hours,sizeof(hours),twenty_four ? "%H" : "%I",local);
    strftime(minutes,sizeof(minutes),"%M",local);
    if (!s_settings.leading_zero && hours[0] == '0') { hours[0]=hours[1]; hours[1]='\0'; }
  }
  const bool big = bounds.size.w >= 200;
  // Fixed stacked layout keeps black numerals entirely in the light left strip.
  int margin = PBL_IF_ROUND_ELSE(big ? 42 : 30, big ? 5 : 4);
  int font_size = big ? 30 : 22;
  int line = big ? 38 : 28;
  int y = bounds.size.h - margin - font_size - line;
  int hour_bearing = stack_left_bearing(hours[0],font_size,s_settings.numeral_font) + (hours[1] ? 0 : font_size / 4);
  int minute_bearing = stack_left_bearing(minutes[0],font_size,s_settings.numeral_font);
  int left_bearing = hour_bearing < minute_bearing ? hour_bearing : minute_bearing;
  GRect box = GRect(margin - left_bearing,y,font_size,48);
  graphics_context_set_text_color(ctx, GColorBlack);
  graphics_draw_text(ctx,hours,s_stack_font,box,GTextOverflowModeFill,GTextAlignmentCenter,NULL);
  box.origin.y += line;
  graphics_draw_text(ctx,minutes,s_stack_font,box,GTextOverflowModeFill,GTextAlignmentCenter,NULL);

  if (s_settings.show_weather) {
    char temperature[16] = "--\xC2\xB0";
    if (weather_is_fresh(now)) {
      int tenths = s_settings.fahrenheit ? s_temperature * 9 / 5 + 320 : s_temperature;
      int degrees = tenths < 0 ? (tenths - 5) / 10 : (tenths + 5) / 10;
      snprintf(temperature,sizeof(temperature),"%d\xC2\xB0",degrees);
    }
    int temp_font_size = big ? 22 : 18;
    int temp_width = big ? 63 : 48;
    GRect temp_box = GRect(0,bounds.size.h-margin-temp_font_size,temp_width,40);
    GFont temp_font = s_temperature_font;
    GSize measured = graphics_text_layout_get_content_size(temperature,temp_font,
        GRect(0,0,300,60),GTextOverflowModeFill,GTextAlignmentLeft);
    // Only unusually wide readings use a smaller font to avoid truncation.
    if (measured.w > temp_width) {
      temp_font = s_small_temperature_font;
      temp_box.origin.y += temp_font_size - (big ? 18 : 16);
      temp_font_size = big ? 18 : 16;
    }
    temp_box.origin.x = temperature_box_x(temperature,s_settings.numeral_font,temp_font_size,
        bounds.size.w,bounds.size.h,temp_box.origin.y,temp_width,PBL_IF_ROUND_ELSE(true,false));
    // The fixed dark edge protects the pale temperature over light whiskers.
    outlined_text_color(ctx,temperature,temp_font,temp_box,GTextAlignmentRight,cream,GColorBlack);
  }
}

static void request_weather(void) {
  time_t now = time(NULL);
  if (!s_settings.show_weather || !s_js_ready || !connection_service_peek_pebble_app_connection()) return;
  if (s_last_weather_request && now - s_last_weather_request < WEATHER_RETRY_SECONDS) return;
  DictionaryIterator *iter;
  if (app_message_outbox_begin(&iter) != APP_MSG_OK) return;
  dict_write_uint8(iter, MESSAGE_KEY_REQUEST_WEATHER, 1);
  if (app_message_outbox_send() == APP_MSG_OK) s_last_weather_request = now;
}

static void tick_handler(struct tm *tick_time, TimeUnits changed) {
  (void)tick_time;
  (void)changed;
  sync_seconds();
  redraw();
  time_t now = time(NULL);
  if (!weather_is_fresh(now) || now - s_weather_time >= s_settings.weather_interval * 60) request_weather();
}

static void play_disconnect_alert(void) {
  static const uint32_t short_tap[] = {200};
  static const uint32_t double_tap[] = {150, 100, 150};
  static const uint32_t triple_tap[] = {100, 100, 100, 100, 100};
  static const uint32_t long_short[] = {400, 150, 100};
  const VibePattern patterns[] = {
    {.durations=short_tap,.num_segments=ARRAY_LENGTH(short_tap)},
    {.durations=double_tap,.num_segments=ARRAY_LENGTH(double_tap)},
    {.durations=triple_tap,.num_segments=ARRAY_LENGTH(triple_tap)},
    {.durations=long_short,.num_segments=ARRAY_LENGTH(long_short)}
  };
  vibes_enqueue_custom_pattern(patterns[s_settings.disconnect_pattern]);
}

static void connection_handler(bool connected) {
  const bool disconnected = s_phone_connected && !connected;
  s_phone_connected = connected;
  if (disconnected && s_settings.disconnect_vibe &&
      (s_settings.disconnect_ignore_quiet || !quiet_time_is_active())) {
    play_disconnect_alert();
  }
}

static void load_numeral_fonts(void) {
  const bool big = PBL_DISPLAY_WIDTH >= 200;
  if (s_temperature_font) fonts_unload_custom_font(s_temperature_font);
  if (s_small_temperature_font) fonts_unload_custom_font(s_small_temperature_font);
  if (s_stack_font) fonts_unload_custom_font(s_stack_font);
  s_temperature_font = fonts_load_custom_font(resource_get_handle(numeral_resource(s_settings.numeral_font,big ? 22 : 18)));
  s_small_temperature_font = fonts_load_custom_font(resource_get_handle(numeral_resource(s_settings.numeral_font,big ? 18 : 16)));
  s_stack_font = fonts_load_custom_font(resource_get_handle(numeral_resource(s_settings.numeral_font,big ? 30 : 22)));
}

static void inbox_received(DictionaryIterator *iter, void *context) {
  (void)context;
  int previous_font = s_settings.numeral_font;
  if (settings_receive(&s_settings,iter)) {
    if (s_canvas && previous_font != s_settings.numeral_font) load_numeral_fonts();
    stop_spin(); s_phase = 0;
    sync_seconds();
    s_last_weather_request = 0;
    request_weather();
  }
  Tuple *ready = dict_find(iter, MESSAGE_KEY_JS_READY);
  if (ready) {
    s_js_ready = true;
    request_weather();
  }
  Tuple *temp = dict_find(iter, MESSAGE_KEY_TEMPERATURE);
  Tuple *stamp = dict_find(iter, MESSAGE_KEY_WEATHER_TIME);
  if (temp && stamp && temp->length == 4 && stamp->length == 4 &&
      (temp->type == TUPLE_INT || temp->type == TUPLE_UINT) &&
      (stamp->type == TUPLE_INT || stamp->type == TUPLE_UINT)) {
    int32_t value = temp->value->int32;
    int32_t fetched = stamp->value->int32;
    time_t now = time(NULL);
    if (value >= -1000 && value <= 700 && fetched > 0 && fetched <= now && now - fetched <= WEATHER_MAX_AGE) {
      s_temperature = value;
      s_weather_time = fetched;
      s_has_weather = true;
      persist_write_int(WEATHER_CACHE_KEY, value);
      persist_write_int(WEATHER_TIME_KEY, fetched);
    }
  }
  redraw();
}

static void window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(root);
  s_background = gbitmap_create_with_resource(RESOURCE_ID_IMAGE_BG);
  load_numeral_fonts();
  s_canvas = layer_create(bounds);
  layer_set_update_proc(s_canvas, canvas_update);
  layer_add_child(root, s_canvas);
}

static void window_unload(Window *window) {
  (void)window;
  stop_spin();
  stop_seconds();
  layer_destroy(s_canvas);
  s_canvas = NULL;
  gbitmap_destroy(s_background);
  fonts_unload_custom_font(s_temperature_font);
  fonts_unload_custom_font(s_small_temperature_font);
  fonts_unload_custom_font(s_stack_font);
}

static void init(void) {
  settings_load(&s_settings);
  // Seed silently so opening the face while disconnected never buzzes.
  s_phone_connected = connection_service_peek_pebble_app_connection();
  connection_service_subscribe((ConnectionHandlers){.pebble_app_connection_handler = connection_handler});
  s_has_weather = persist_exists(WEATHER_CACHE_KEY) && persist_exists(WEATHER_TIME_KEY);
  if (s_has_weather) {
    s_temperature = persist_read_int(WEATHER_CACHE_KEY);
    s_weather_time = persist_read_int(WEATHER_TIME_KEY);
  }
  s_window = window_create();
  window_set_background_color(s_window, GColorBlack);
  window_set_window_handlers(s_window, (WindowHandlers){.load = window_load, .unload = window_unload});
  window_stack_push(s_window, false);
  s_focused = true;
  sync_seconds();
  tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);
  accel_tap_service_subscribe(tap_handler);
  app_focus_service_subscribe(focus_handler);
#ifdef _PBL_API_EXISTS_backlight_service_subscribe
  backlight_service_subscribe(backlight_handler);
#endif
  app_message_register_inbox_received(inbox_received);
  app_message_open(512, 64);
}

static void deinit(void) {
  stop_spin();
  stop_seconds();
  tick_timer_service_unsubscribe();
  connection_service_unsubscribe();
  accel_tap_service_unsubscribe();
  app_focus_service_unsubscribe();
#ifdef _PBL_API_EXISTS_backlight_service_subscribe
  backlight_service_unsubscribe();
#endif
  app_message_deregister_callbacks();
  window_destroy(s_window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
