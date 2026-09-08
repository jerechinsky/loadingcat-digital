#include <assert.h>
#include <stdio.h>
#include "../src/c/spinner_geometry.h"
int main(void) {
  int counts[]={6,7,8,10};
  for(int k=0;k<4;k++)for(int phase=0;phase<counts[k];phase++)for(int dir=-1;dir<=1;dir+=2) {
    int white=0;
    for(int i=0;i<counts[k];i++) {
      int b=spinner_bucket(phase,i,dir,counts[k]);
      assert(b>=0 && b<8);
      assert(spinner_length(b)>=12 && spinner_length(b)<=16);
      if(spinner_brightness(b)==255)white++;
    }
    assert(white==2 || white==3);
  }
  for(int b=0;b<8;b++) {
    int bright=spinner_brightness(b),on=0;
    for(int y=0;y<4;y++)for(int x=0;x<4;x++)on+=spinner_dither(x,y,bright);
    assert(on==(bright==255?16:(bright==170?11:5)));
  }
  for(int r=1;r<=3;r++)for(int x=-10;x<=10;x++)for(int y=-10;y<=10;y++) {
    assert(spinner_contains(x,y,0,0,7,5,r)==spinner_contains(x,y,7,5,0,0,r));
    assert(spinner_contains(x,y,0,0,7,5,r)==spinner_contains(-x,-y,0,0,-7,-5,r));
  }
  assert(spinner_contains(0,0,0,0,8,0,2));
  assert(spinner_contains(8,2,0,0,8,0,2));
  assert(!spinner_contains(9,2,0,0,8,0,2));
  puts("Spinner geometry passed: both directions, every phase, consistent heads, capsule symmetry and fixed dither coverage.");
}
