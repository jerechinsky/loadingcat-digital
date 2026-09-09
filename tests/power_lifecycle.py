"""Exercise production trigger subscriptions and weather inbox side effects."""
from pathlib import Path
import subprocess,tempfile
root=Path(__file__).resolve().parents[1];source=(root/'src/c/main.c').read_text()
triggers=source[source.index('static void sync_triggers('):source.index('static void focus_handler(')]
inbox=source[source.index('static void inbox_received('):source.index('static void window_load(')]
prefix=r'''
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <assert.h>
#include <time.h>
#define _PBL_API_EXISTS_backlight_service_subscribe 1
#define MESSAGE_KEY_JS_READY 1
#define MESSAGE_KEY_TEMPERATURE 2
#define MESSAGE_KEY_WEATHER_TIME 3
#define MESSAGE_KEY_WEATHER_RESPONSE_LOCATION 4
#define TUPLE_INT 1
#define TUPLE_UINT 2
#define WEATHER_MAX_AGE 7200
#define WEATHER_CACHE_KEY 20
#define WEATHER_TIME_KEY 21
#define WEATHER_LOCATION_CACHE_KEY 22
typedef struct {int32_t int32;} Value;
typedef struct {int length,type;Value *value;} Tuple;
typedef struct {bool ready,weather,has_location;Value temperature,stamp,location;} DictionaryIterator;
static bool s_focused,s_tap_subscribed,s_light_subscribed,paused,s_js_ready,s_has_weather;
static struct {int show_spinner,animate,flick_trigger,light_trigger,numeral_font,show_weather,weather_interval,weather_location;} s_settings;
static int s_phase,s_temperature,s_weather_time,s_last_weather_request,draws,requests,writes,tap_add,tap_remove,light_add,light_remove;
static void *s_canvas=(void*)1;
static int change;static bool did_change;
static bool animation_paused_now(void){return paused;}
static void tap_handler(void){}
static void backlight_handler(void){}
static void accel_tap_service_subscribe(void(*fn)(void)){(void)fn;tap_add++;}
static void accel_tap_service_unsubscribe(void){tap_remove++;}
static void backlight_service_subscribe(void(*fn)(void)){(void)fn;light_add++;}
static void backlight_service_unsubscribe(void){light_remove++;}
static bool settings_receive(void *settings,void *dict){
 (void)settings;(void)dict;
 if(!did_change)return false;
 if(change==1)s_settings.numeral_font++;
 if(change==2)s_settings.show_weather=1;
 if(change==3)s_settings.weather_interval=60;
 if(change==4)s_settings.weather_location=123;
 if(change==5)s_settings.weather_location=0;
 return true;
}
static void load_numeral_fonts(void){}
static void stop_spin(void){}
static void sync_seconds(void){}
static void request_weather(void){if(s_settings.show_weather&&s_js_ready)requests++;}
static void persist_write_int(int key,int value){(void)key;(void)value;writes++;}
static void persist_delete(int key){(void)key;}
static void redraw(void){draws++;}
static Tuple *dict_find(DictionaryIterator *d,int key){
 static Tuple result;result.length=4;result.type=TUPLE_INT;
 if(key==MESSAGE_KEY_JS_READY)return d->ready?&result:NULL;
 if(key==MESSAGE_KEY_WEATHER_RESPONSE_LOCATION){
   static Tuple location;location=(Tuple){4,TUPLE_INT,&d->location};return d->has_location?&location:NULL;
 }
 if(!d->weather)return NULL;
 result.value=key==MESSAGE_KEY_TEMPERATURE?&d->temperature:&d->stamp;
 // Production holds both pointers simultaneously, as a real DictionaryIterator does.
 static Tuple temp,stamp;
 if(key==MESSAGE_KEY_TEMPERATURE){temp=result;return &temp;}
 stamp=result;return &stamp;
}
'''
suffix=r'''
int main(void){
 s_focused=true;s_settings.show_spinner=1;s_settings.animate=1;s_settings.flick_trigger=1;s_settings.light_trigger=1;
 sync_triggers();assert(tap_add==1&&light_add==1);
 sync_triggers();assert(tap_add==1&&light_add==1);
 paused=true;sync_triggers();assert(!s_tap_subscribed&&!s_light_subscribed&&tap_remove==1&&light_remove==1);
 paused=false;sync_triggers();assert(tap_add==2&&light_add==2);
 s_focused=false;sync_triggers();assert(!s_tap_subscribed&&!s_light_subscribed);
 s_focused=true;s_settings.animate=0;sync_triggers();assert(!s_tap_subscribed&&!s_light_subscribed);
 s_settings.animate=1;s_settings.flick_trigger=0;sync_triggers();assert(!s_tap_subscribed&&s_light_subscribed);
 s_settings.show_spinner=0;sync_triggers();assert(!s_tap_subscribed&&!s_light_subscribed);
 DictionaryIterator d={.ready=true};s_settings.show_weather=1;s_settings.weather_interval=30;
 inbox_received(&d,NULL);assert(requests==1&&draws==0&&writes==0);
 d.ready=false;did_change=true;change=1;inbox_received(&d,NULL);assert(requests==1&&writes==0);
 s_settings.show_weather=0;change=2;inbox_received(&d,NULL);assert(requests==2);
 change=3;inbox_received(&d,NULL);assert(requests==3);
 did_change=false;d.weather=true;d.temperature.int32=220;d.stamp.int32=time(NULL)-600;
 inbox_received(&d,NULL);assert(writes==3&&s_has_weather);
 int prior=draws;inbox_received(&d,NULL);assert(writes==3&&draws==prior);
 d.stamp.int32++;inbox_received(&d,NULL);assert(writes==4);
 d.temperature.int32++;inbox_received(&d,NULL);assert(writes==5);
 // A source change clears old data immediately and only matching responses restore it.
 did_change=true;change=4;d.weather=false;inbox_received(&d,NULL);assert(!s_has_weather&&requests==4);
 did_change=false;d.weather=true;prior=writes;inbox_received(&d,NULL);assert(!s_has_weather&&writes==prior);
 d.has_location=true;d.location.int32=124;inbox_received(&d,NULL);assert(!s_has_weather&&writes==prior);
 d.location.int32=123;inbox_received(&d,NULL);assert(s_has_weather&&writes==prior+3);
 did_change=true;change=5;d.weather=false;inbox_received(&d,NULL);assert(!s_has_weather&&requests==5);
 did_change=false;d.weather=true;prior=writes;inbox_received(&d,NULL);assert(!s_has_weather&&writes==prior);
 d.location.int32=0;inbox_received(&d,NULL);assert(s_has_weather);
 puts("Power lifecycle passed: weather cache invalidation and stale-location response rejection; disabled/night/hidden triggers unsubscribe, idempotent subscriptions, one startup request, unrelated settings do not request weather, duplicate weather does not redraw or write flash.");
}
'''
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp);(p/'power.c').write_text(prefix+triggers+inbox+suffix)
 subprocess.run(['clang','-std=c11','-Wall','-Wextra','-Werror',str(p/'power.c'),'-o',str(p/'power')],check=True)
 subprocess.run([str(p/'power')],check=True)
