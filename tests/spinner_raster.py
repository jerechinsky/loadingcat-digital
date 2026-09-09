"""Compare production run drawing against the original pixel rasterizer.
Checks every phase/direction/count, both palettes and all seven screen targets.
Reports drawing calls, not battery-life estimates.
"""
from pathlib import Path
import subprocess,tempfile,json
root=Path(__file__).resolve().parents[1]
s=(root/'src/c/main.c').read_text()
production=s[s.index('static void draw_spinner('):s.index('static bool weather_is_fresh(')]
reference=r'''
static void draw_reference(GContext *ctx) {
 GPoint center=GPoint(SPINNER_X+background_shift(),SPINNER_Y);
 int count=segment_count(),width=scaled(4),inner=scaled(15);if(width<2)width=2;
 int radius=width/2;
 for(int i=0;i<count;++i){
  int bucket=spinner_bucket(s_phase,i,s_direction,count),outer=inner+scaled(spinner_length(bucket)),brightness=spinner_brightness(bucket);
  const int16_t *v=spinner_vector(count,i);
  int ax=center.x+v[0]*inner/1000,ay=center.y+v[1]*inner/1000,bx=center.x+v[0]*outer/1000,by=center.y+v[1]*outer/1000;
  for(int y=(ay<by?ay:by)-radius;y<=(ay>by?ay:by)+radius;++y)
   for(int x=(ax<bx?ax:bx)-radius;x<=(ax>bx?ax:bx)+radius;++x){
    if(!spinner_contains(x,y,ax,ay,bx,by,radius))continue;
    ctx->color=display_color(PBL_IF_COLOR_ELSE(GColorFromRGB(brightness,brightness,brightness),spinner_dither(x,y,brightness)?GColorWhite:GColorBlack));
    ctx->pixels[y][x]=ctx->color;++ctx->calls;
   }
 }
}
'''
prefix=r'''
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <assert.h>
#include "spinner_geometry.h"
typedef int GColor;
#define GColorBlack 0
#define GColorWhite 255
#define GColorFromRGB(r,g,b) (r)
#define GCornerNone 0
#define PBL_IF_COLOR_ELSE(a,b) (color_screen?(a):(b))
typedef struct {int x,y;} GPoint;
#define GPoint(x,y) ((GPoint){x,y})
typedef struct {int x,y,w,h;} GRect;
#define GRect(x,y,w,h) ((GRect){x,y,w,h})
typedef struct {int pixels[300][300];int color;unsigned calls;} GContext;
static int SPINNER_X,SPINNER_Y,SPINNER_SCALE,shift,count,s_phase,s_direction;
static bool color_screen,inverted;
static GColor display_color(GColor color){return inverted?255-color:color;}
static bool gcolor_equal(GColor a,GColor b){return a==b;}
static int segment_count(void){return count;}
static int scaled(int v){return (v*SPINNER_SCALE+50)/100;}
static int background_shift(void){return shift;}
static void graphics_context_set_antialiased(GContext*c,bool b){(void)c;(void)b;}
static void graphics_context_set_stroke_width(GContext*c,int b){(void)c;(void)b;}
static void graphics_context_set_fill_color(GContext*c,GColor color){c->color=color;}
static void graphics_fill_rect(GContext*c,GRect r,int radius,int corner){
 (void)radius;(void)corner;++c->calls;
 for(int y=r.y;y<r.y+r.h;++y)for(int x=r.x;x<r.x+r.w;++x){assert(x>=0&&x<300&&y>=0&&y<300);c->pixels[y][x]=c->color;}
}
'''
suffix=r'''
int main(void){
 int counts[]={6,7,8,10,12};
 int models[][5]={{66,49,74,7,0},{66,49,74,7,1},{82,56,85,34,1},{66,49,74,7,0},{90,67,100,7,1},{66,49,74,7,0},{119,81,132,48,1}};
 unsigned before=0,after=0,cases=0;
 for(int m=0;m<7;++m){
  SPINNER_X=models[m][0];SPINNER_Y=models[m][1];SPINNER_SCALE=models[m][2];shift=models[m][3];color_screen=models[m][4];
  for(int c=0;c<5;++c)for(int p=0;p<counts[c];++p)for(int d=-1;d<=1;d+=2)for(int inv=0;inv<2;++inv){
   count=counts[c];s_phase=p;s_direction=d;inverted=inv;
   static GContext old,next;memset(&old,0,sizeof(old));memset(&next,0,sizeof(next));
   // Sentinel makes any newly erased or omitted black pixels visible to the comparison.
   memset(old.pixels,0x55,sizeof(old.pixels));memset(next.pixels,0x55,sizeof(next.pixels));
   draw_reference(&old);draw_spinner(&next);assert(!memcmp(old.pixels,next.pixels,sizeof(old.pixels)));
   before+=old.calls;after+=next.calls;cases++;
  }
 }
 assert(after<before);
 printf("{\"cases\":%u,\"pixel_identical\":true,\"original_pixel_calls\":%u,\"new_span_calls\":%u,\"drawing_call_reduction_percent\":%.1f}\n",cases,before,after,100.0*(before-after)/before);
}
'''
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp);(p/'raster.c').write_text(prefix+production+reference+suffix)
 subprocess.run(['clang','-std=c11','-O2','-Wall','-Wextra','-Werror','-I',str(root/'src/c'),str(p/'raster.c'),'-o',str(p/'raster')],check=True)
 subprocess.run([str(p/'raster')],check=True)
