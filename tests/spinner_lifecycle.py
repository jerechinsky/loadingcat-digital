"""Run the production timer/kick code with a deterministic clock and Pebble timer stub."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
source = (root / 'src/c/main.c').read_text()
start = source.index('static uint32_t now_ms(void)')
end = source.index('static void tap_handler(')
production = source[start:end]
prefix = r'''
#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <time.h>
#include "spin.h"
#include "seconds.h"
#include "night.h"
typedef struct AppTimer { bool active; uint64_t due; void (*fn)(void *); void *ctx; } AppTimer;
static AppTimer timers[4], *s_spin_timer, *s_seconds_timer;
static struct { int spokes, show_spinner, second_hand, animate, spin_motion, spin_length, night_seconds_pause, night_pause, night_start, night_end; } s_settings;
static uint8_t s_phase, s_step;
static int8_t s_direction;
static bool s_focused, s_spinning;
static uint32_t s_last_kick;
static void *s_canvas = (void *)1;
static uint64_t clock_ms;
static int first_draw, draws;
static struct tm *fake_localtime(const time_t *t) {
  static struct tm local; local.tm_hour=(*t/3600)%24; return &local;
}
#define localtime fake_localtime
#define APP_LOG(...) ((void)0)
static void time_ms(time_t *seconds, uint16_t *ms) { *seconds=clock_ms/1000; *ms=clock_ms%1000; }
static void layer_mark_dirty(void *p) { (void)p; if(!draws) first_draw=s_phase; ++draws; }
static void app_timer_cancel(AppTimer *t) { assert(t->active); t->active=false; }
static AppTimer *app_timer_register(uint32_t delay,void (*fn)(void *),void *ctx) {
  assert(delay>0);
  for(int i=0;i<4;++i) if(!timers[i].active) {
    timers[i]=(AppTimer){true,clock_ms+delay,fn,ctx}; return &timers[i];
  }
  assert(false); return NULL;
}
'''
suffix = r'''
static void advance(uint64_t target) {
  for(;;) {
    AppTimer *next=NULL;
    for(int i=0;i<4;++i) if(timers[i].active && timers[i].due<=target && (!next || timers[i].due<next->due)) next=&timers[i];
    if(!next) break;
    clock_ms=next->due; next->active=false; next->fn(next->ctx);
  }
  clock_ms=target;
}
static void reset(int count,int motion,int length,uint32_t position) {
  for(int i=0;i<4;++i) timers[i].active=false;
  s_spin_timer=s_seconds_timer=NULL; s_spinning=false; s_focused=true; s_last_kick=0;
  s_phase=0; s_direction=1; draws=0; first_draw=-1;
  s_settings.spokes=count;s_settings.spin_motion=motion;s_settings.spin_length=length;
  s_settings.second_hand=1;s_settings.show_spinner=1;s_settings.animate=1;
  s_settings.night_seconds_pause=0;s_settings.night_pause=0;s_settings.night_start=22;s_settings.night_end=7;
  clock_ms=600000u+position;
  sync_seconds();
}
int main(void) {
  int counts[]={6,7,8,10,12}; uint32_t positions[]={0,4500,7400,56000,58000,59000}; int cases=0;
  for(int c=0;c<5;++c) for(int m=0;m<2;++m) for(int l=0;l<3;++l) for(int d=-1;d<=1;d+=2) for(int p=0;p<6;++p) {
    reset(counts[c],m,l,positions[p]);
    draws=0; int start=seconds_phase(minute_ms(),counts[c]);
    kick_spin(d); assert(s_spinning); assert(first_draw==start); assert(!s_seconds_timer);
    uint64_t begin=clock_ms;
    advance(begin+300); uint32_t last=s_last_kick; kick_spin(d); assert(s_last_kick==last); // merged duplicate event
    advance(begin+spin_duration_ms(l));
    assert(!s_spinning); assert(s_phase==seconds_phase(minute_ms(),counts[c]));
    assert(s_direction==1 && s_seconds_timer && !s_spin_timer);
    uint32_t next=seconds_delay_ms(minute_ms(),counts[c]); advance(clock_ms+next);
    assert(s_phase==seconds_phase(minute_ms(),counts[c]));

    // A second deliberate flick must restart at the live seconds position,
    // regardless of the intermediate animation phase or a minute rollover.
    reset(counts[c],m,l,positions[p]); kick_spin(d); advance(clock_ms+900);
    assert(s_spinning); s_phase=(seconds_phase(minute_ms(),counts[c])+counts[c]/2)%counts[c];
    draws=0; start=seconds_phase(minute_ms(),counts[c]); kick_spin(-d);
    assert(first_draw==start); advance(clock_ms+spin_duration_ms(l));
    assert(!s_spinning && s_phase==seconds_phase(minute_ms(),counts[c]));

    // Turning seconds mode off preserves the chosen coasting behavior.
    reset(counts[c],m,l,positions[p]); s_settings.second_hand=0; stop_seconds(); s_phase=3;
    draws=0; kick_spin(d); assert(first_draw==3); advance(clock_ms+spin_duration_ms(l));
    int expected=(3+d*(spin_steps(counts[c],m)%counts[c])+counts[c])%counts[c];
    assert(s_phase==expected && !s_spinning && !s_seconds_timer);
    ++cases;
  }
  // Exhaust every local-hour interval, including wraparound and equal endpoints.
  for(int start=0;start<24;++start)for(int end=0;end<24;++end)for(int hour=0;hour<24;++hour) {
    bool expected=false;
    for(int h=start;h!=end;h=(h+1)%24)if(h==hour)expected=true;
    assert(night_paused(true,start,end,hour)==expected);
    assert(!night_paused(false,start,end,hour));
  }
  for(int direction=-1;direction<=1;direction+=2) {
    reset(12,1,0,0);s_settings.night_pause=1;clock_ms=22u*3600000u;sync_seconds();
    kick_spin(direction);assert(!s_spinning);advance(clock_ms+5000);assert(s_phase==1);
    clock_ms=6u*3600000u+3599000u;sync_seconds();kick_spin(direction);assert(!s_spinning);
    advance(clock_ms+1000);kick_spin(direction);assert(s_spinning); // resumes exactly at 07:00
    stop_spin();stop_seconds();
    reset(12,0,0,0);s_settings.night_pause=1;clock_ms=22u*3600000u-1000;sync_seconds();
    kick_spin(direction);assert(s_spinning);advance(clock_ms+2000);
    assert(!s_spinning && s_phase==seconds_phase(minute_ms(),12)); // stops when night begins mid-spin
  }
  for(int animation_pause=0;animation_pause<=1;++animation_pause) {
    reset(12,1,0,0);s_settings.night_seconds_pause=1;s_settings.night_pause=animation_pause;
    clock_ms=22u*3600000u-1000;sync_seconds();assert(s_seconds_timer);
    advance(22u*3600000u);sync_seconds();assert(!s_seconds_timer);
    int frozen=s_phase;advance(clock_ms+60000);sync_seconds();assert(s_phase==frozen && !s_seconds_timer);
    kick_spin(1);assert(s_spinning==!animation_pause);
    advance(clock_ms+4000);assert(!s_spinning && !s_seconds_timer);
    clock_ms=7u*3600000u;sync_seconds();assert(s_seconds_timer && s_phase==0);
    s_settings.night_start=7;s_settings.night_end=7;sync_seconds();assert(s_seconds_timer);
  }
  puts("Independent seconds pause passed: timer cancellation, frozen position, independent animation and morning resumption.");
  puts("Night pause passed: every hourly schedule, both trigger directions, 22:00/07:00 boundaries, mid-spin cancellation and continuing seconds.");
  printf("Spinner lifecycle passed: %d combinations, first and repeated kicks, live end position, minute rollover, debounce and seconds-off behavior.\n",cases);
}
'''
with tempfile.TemporaryDirectory() as d:
    c = Path(d) / 'lifecycle.c'
    c.write_text(prefix + production + suffix)
    binary = Path(d) / 'lifecycle'
    subprocess.run(['clang', '-std=c11', '-Wall', '-Wextra', '-Werror', '-I'+str(root/'src/c'), str(c), '-o', str(binary)], check=True)
    subprocess.run([str(binary)], check=True)
