#pragma once
#include <stdint.h>
// Generated from the shipped font rasters.
static int stack_left_bearing(char digit,int size,int family) {
static const int8_t bearings[9][4][10] = {{{2,4,2,2,1,2,2,2,2,1},{1,3,1,1,0,1,1,1,1,1},{1,2,1,1,0,1,1,1,1,1},{1,2,1,1,0,1,1,1,1,1}},{{1,3,2,1,1,2,1,2,1,1},{1,3,1,1,1,1,1,1,1,1},{1,2,1,1,1,1,1,1,1,1},{1,2,1,1,0,1,1,1,1,1}},{{1,3,1,1,1,1,1,1,1,1},{1,2,1,1,0,1,1,1,1,1},{1,2,1,1,0,1,1,1,1,1},{1,2,1,1,0,1,1,1,1,1}},{{1,2,2,1,1,2,2,1,2,1},{1,2,1,1,1,1,1,1,1,1},{1,1,1,1,0,1,1,1,1,1},{1,1,1,1,0,1,1,1,1,1}},{{1,2,1,1,1,2,1,1,2,1},{1,2,1,1,1,1,1,1,1,1},{1,1,1,1,1,1,1,1,1,1},{1,1,1,1,0,1,1,1,1,1}},{{2,2,3,2,2,2,2,2,2,2},{1,2,2,1,1,2,2,1,1,1},{1,1,2,1,1,1,1,1,1,1},{1,1,1,1,1,1,1,1,1,1}},{{1,1,2,2,1,2,1,2,1,1},{1,1,1,1,1,1,1,1,1,1},{1,1,1,1,0,1,1,1,1,1},{1,1,1,1,0,1,1,1,1,1}},{{1,1,1,1,1,1,1,1,1,1},{1,1,1,1,1,1,1,1,1,1},{1,1,1,1,1,1,1,1,1,1},{1,1,1,1,1,1,1,1,1,1}},{{1,1,1,1,1,1,1,1,1,1},{1,1,1,1,1,1,1,1,1,1},{1,1,1,1,1,1,1,1,1,1},{1,1,1,1,1,1,1,1,1,1}}};
if(digit<'0'||digit>'9')return 0;
if(family<0 || family>=9)family=0;
return bearings[family][size==30?0:(size==22?1:(size==18?2:3))][digit-'0'];
}
static uint32_t numeral_resource(int family,int size) {
switch(family) {
case 0: return size==30?RESOURCE_ID_FONT_NUM_A_30:(size==22?RESOURCE_ID_FONT_NUM_A_22:(size==18?RESOURCE_ID_FONT_NUM_A_18:RESOURCE_ID_FONT_NUM_A_16));
case 1: return size==30?RESOURCE_ID_FONT_NUM_B_30:(size==22?RESOURCE_ID_FONT_NUM_B_22:(size==18?RESOURCE_ID_FONT_NUM_B_18:RESOURCE_ID_FONT_NUM_B_16));
case 2: return size==30?RESOURCE_ID_FONT_NUM_C_30:(size==22?RESOURCE_ID_FONT_NUM_C_22:(size==18?RESOURCE_ID_FONT_NUM_C_18:RESOURCE_ID_FONT_NUM_C_16));
case 3: return size==30?RESOURCE_ID_FONT_NUM_D_30:(size==22?RESOURCE_ID_FONT_NUM_D_22:(size==18?RESOURCE_ID_FONT_NUM_D_18:RESOURCE_ID_FONT_NUM_D_16));
case 4: return size==30?RESOURCE_ID_FONT_NUM_E_30:(size==22?RESOURCE_ID_FONT_NUM_E_22:(size==18?RESOURCE_ID_FONT_NUM_E_18:RESOURCE_ID_FONT_NUM_E_16));
case 5: return size==30?RESOURCE_ID_FONT_NUM_F_30:(size==22?RESOURCE_ID_FONT_NUM_F_22:(size==18?RESOURCE_ID_FONT_NUM_F_18:RESOURCE_ID_FONT_NUM_F_16));
case 6: return size==30?RESOURCE_ID_FONT_NUM_G_30:(size==22?RESOURCE_ID_FONT_NUM_G_22:(size==18?RESOURCE_ID_FONT_NUM_G_18:RESOURCE_ID_FONT_NUM_G_16));
case 7: return size==30?RESOURCE_ID_FONT_NUM_H_30:(size==22?RESOURCE_ID_FONT_NUM_H_22:(size==18?RESOURCE_ID_FONT_NUM_H_18:RESOURCE_ID_FONT_NUM_H_16));
case 8: return size==30?RESOURCE_ID_FONT_NUM_I_30:(size==22?RESOURCE_ID_FONT_NUM_I_22:(size==18?RESOURCE_ID_FONT_NUM_I_18:RESOURCE_ID_FONT_NUM_I_16));
default:return RESOURCE_ID_FONT_NUM_A_22;
}
}
