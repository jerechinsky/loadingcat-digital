#pragma once
#include <stdbool.h>
#include <stdint.h>

// Quantized unit vectors give straight, evenly spaced spokes at small pixel sizes.
static const int16_t SPINNER_VECTORS[5][12][2] = {
  {{0,-1000},{866,-500},{866,500},{0,1000},{-866,500},{-866,-500}},
  {{0,-1000},{782,-623},{975,223},{434,901},{-434,901},{-975,223},{-782,-623}},
  {{0,-1000},{707,-707},{1000,0},{707,707},{0,1000},{-707,707},{-1000,0},{-707,-707}},
  {{0,-1000},{588,-809},{951,-309},{951,309},{588,809},{0,1000},{-588,809},{-951,309},{-951,-309},{-588,-809}},
  {{0,-1000},{500,-866},{866,-500},{1000,0},{866,500},{500,866},{0,1000},{-500,866},{-866,500},{-1000,0},{-866,-500},{-500,-866}}
};
static inline const int16_t *spinner_vector(int count,int spoke) {
  return SPINNER_VECTORS[count==6?0:(count==7?1:(count==12?4:(count==10?3:2)))][spoke];
}
static inline int spinner_bucket(int phase,int spoke,int direction,int count) {
  return (((phase-spoke)*direction+count)%count)*8/count;
}
static inline int spinner_length(int bucket) {
  static const uint8_t lengths[] = {16,16,15,14,13,12,12,13};
  return lengths[bucket];
}
static inline int spinner_brightness(int bucket) {
  return bucket<2?255:(bucket<4?170:85);
}
static inline bool spinner_dither(int x,int y,int brightness) {
  static const uint8_t bayer[4][4] = {{0,8,2,10},{12,4,14,6},{3,11,1,9},{15,7,13,5}};
  return bayer[y&3][x&3] < (brightness==255?16:(brightness==170?11:5));
}
// An integer capsule makes straight strokes and small round ends without AA.
static inline bool spinner_contains(int x,int y,int ax,int ay,int bx,int by,int radius) {
  int vx=bx-ax,vy=by-ay,px=x-ax,py=y-ay;
  int length2=vx*vx+vy*vy,dot=px*vx+py*vy,radius2=radius*radius;
  if(dot<=0)return px*px+py*py<=radius2;
  if(dot>=length2){px=x-bx;py=y-by;return px*px+py*py<=radius2;}
  int cross=px*vy-py*vx;
  return cross*cross<=radius2*length2;
}
