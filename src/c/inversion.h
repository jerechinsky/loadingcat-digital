#pragma once
#include <pebble.h>

// A natural white-cat palette, applied once to a freshly loaded bitmap.
// Black fur becomes white; the pale backdrop becomes black. Keep the original
// dark shading and pink ears. Original eyes are drawn separately over the fur.
static uint8_t disconnected_pixel(uint8_t color) {
  uint8_t rgb=color&0x3f;
  int r=(rgb>>4)&3,g=(rgb>>2)&3,b=rgb&3;
  if(rgb==0)return (color&0xc0)|0x3f;
  if(r>=2 && g>=2 && b>=2)return color&0xc0;
  return color;
}
static bool invert_bitmap(GBitmap *bitmap) {
  GBitmapFormat format=gbitmap_get_format(bitmap);
  int colors=format==GBitmapFormat1BitPalette?2:format==GBitmapFormat2BitPalette?4:format==GBitmapFormat4BitPalette?16:0;
  if(colors) {
    GColor *palette=gbitmap_get_palette(bitmap);
    if(!palette)return false;
    for(int i=0;i<colors;++i)palette[i].argb=disconnected_pixel(palette[i].argb);
    return true;
  }
  if(format!=GBitmapFormat1Bit && format!=GBitmapFormat8Bit && format!=GBitmapFormat8BitCircular)return false;
  GRect bounds=gbitmap_get_bounds(bitmap);
  for(int y=bounds.origin.y;y<bounds.origin.y+bounds.size.h;++y) {
    GBitmapDataRowInfo row=gbitmap_get_data_row_info(bitmap,y);
    int first=row.min_x>bounds.origin.x?row.min_x:bounds.origin.x;
    int last=row.max_x<bounds.origin.x+bounds.size.w-1?row.max_x:bounds.origin.x+bounds.size.w-1;
    for(int x=first;x<=last;++x) {
      if(format==GBitmapFormat1Bit)row.data[x/8]^=1u<<(x%8);
      else row.data[x]=disconnected_pixel(row.data[x]);
    }
  }
  return true;
}
