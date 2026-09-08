"""Exercise the actual disconnect handler with connection and Quiet Time transitions."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
source = (root / 'src/c/main.c').read_text()
handler = source[source.index('static void play_disconnect_alert('):source.index('static void load_numeral_fonts(')]
assert source.index('s_phone_connected = connection_service_peek_pebble_app_connection();') < source.index('connection_service_subscribe(')
assert 'connection_service_unsubscribe();' in source
program = '''
#include <assert.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdint.h>
#define ARRAY_LENGTH(a) (sizeof(a)/sizeof((a)[0]))
typedef struct { const uint32_t *durations; uint32_t num_segments; } VibePattern;
static VibePattern last;
static bool s_phone_connected, quiet, s_disconnect_visible, s_disconnect_pending;
static uint32_t clock_ms,s_disconnect_started;
typedef struct {bool active;uint32_t due;void (*callback)(void *);} AppTimer;
static AppTimer timer,*s_disconnect_timer;
static uint32_t now_ms(void){return clock_ms;}
static void redraw(void){}
static void app_timer_cancel(AppTimer *t){assert(t->active);t->active=false;}
static AppTimer *app_timer_register(uint32_t delay,void (*cb)(void *),void *context){
  (void)context;assert(!timer.active);timer=(AppTimer){true,clock_ms+delay,cb};return &timer;
}
static void advance(uint32_t ms){clock_ms+=ms;if(timer.active && clock_ms>=timer.due){timer.active=false;timer.callback(NULL);}}
static struct { int disconnect_vibe, disconnect_pattern, disconnect_ignore_quiet, disconnect_delay; } s_settings;
static int pulses;
static bool quiet_time_is_active(void) { return quiet; }
static void vibes_enqueue_custom_pattern(VibePattern pattern) { ++pulses; last=pattern; }
''' + handler + '''
int main(void) {
  // Starting offline and duplicate events must not alert.
  s_phone_connected=false;s_settings.disconnect_vibe=1;
  connection_handler(false);assert(pulses==0);
  connection_handler(true);assert(pulses==0);
  connection_handler(false);assert(pulses==1);
  connection_handler(false);assert(pulses==1);
  connection_handler(true);assert(pulses==1);
  connection_handler(false);assert(pulses==2);
  // Turning the option on while offline is not itself a disconnection.
  s_settings.disconnect_vibe=0;connection_handler(true);connection_handler(false);assert(pulses==2);
  s_settings.disconnect_vibe=1;connection_handler(false);assert(pulses==2);
  connection_handler(true);connection_handler(false);assert(pulses==3);
  // Quiet Time suppresses the alert and never queues it for later.
  quiet=true;connection_handler(true);connection_handler(false);assert(pulses==3);
  quiet=false;connection_handler(false);assert(pulses==3);
  connection_handler(true);connection_handler(false);assert(pulses==4);
  quiet=true;s_settings.disconnect_ignore_quiet=1;
  for(int pattern=0;pattern<4;++pattern) {
    const int segments[]={1,3,5,3},durations[]={200,400,500,650};
    s_settings.disconnect_pattern=pattern;int before=pulses;
    connection_handler(true);assert(pulses==before);
    connection_handler(false);assert(pulses==before+1);
    assert(last.num_segments==(unsigned)segments[pattern]);
    int total=0;for(unsigned i=0;i<last.num_segments;++i){assert(last.durations[i]>0);total+=last.durations[i];}
    assert(total==durations[pattern]);
  }
  s_settings.disconnect_ignore_quiet=0;int before=pulses;
  connection_handler(true);connection_handler(false);assert(pulses==before);
  quiet=false;s_settings.disconnect_delay=5;connection_handler(true);
  before=pulses;connection_handler(false);assert(s_disconnect_pending && !s_disconnect_visible);
  advance(4999);assert(pulses==before && !s_disconnect_visible);
  connection_handler(false);advance(1);assert(pulses==before+1 && s_disconnect_visible);
  connection_handler(true);assert(!s_disconnect_visible && !s_disconnect_pending);
  connection_handler(false);advance(2000);connection_handler(true);advance(10000);
  assert(pulses==before+1 && !s_disconnect_visible && !s_disconnect_pending);
  connection_handler(false);advance(2000);s_settings.disconnect_delay=10;schedule_disconnect();
  advance(7999);assert(!s_disconnect_visible);advance(1);assert(s_disconnect_visible);
  connection_handler(true);s_settings.disconnect_delay=10;connection_handler(false);advance(6000);
  s_settings.disconnect_delay=5;schedule_disconnect();assert(s_disconnect_visible && !timer.active);
  connection_handler(true);s_settings.disconnect_delay=5;connection_handler(false);before=pulses;
  quiet=true;advance(5000);assert(s_disconnect_visible && pulses==before);
  connection_handler(true);s_settings.disconnect_ignore_quiet=1;connection_handler(false);advance(5000);assert(pulses==before+1);
  puts("Disconnect handler passed: delayed vibration/visual state, cancellation, delay changes and Quiet Time at expiry; all four patterns and Quiet Time override; startup, reconnect, duplicate events, disabled setting, re-enable and Quiet Time.");
}
'''
with tempfile.TemporaryDirectory() as tmp:
    c=Path(tmp)/'disconnect.c'; c.write_text(program); binary=Path(tmp)/'disconnect'
    subprocess.run(['clang','-std=c11','-Wall','-Wextra','-Werror',str(c),'-o',str(binary)],check=True)
    subprocess.run([str(binary)],check=True)
