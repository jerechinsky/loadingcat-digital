#!/usr/bin/env python3
"""Prepare licensed font families for the same fixed clock area.
One common transform per family preserves designed stroke contrast and optical
overshoots. Existing font families retain their outlines. Original Square families are
drawn separately on the pixel grid for each small size.
Requires fonttools, freetype-py and Pillow.
"""
from pathlib import Path
import json, io, base64, shutil, runpy
from PIL import Image
import freetype
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.recordingPen import DecomposingRecordingPen

root=Path(__file__).resolve().parents[1]
runpy.run_path(str(root/'tools/generate_square_fonts.py'),run_name='__main__')
choices=json.loads((root/'tools/fonts.json').read_text())
chars='0123456789-°:'
preview={'fonts':{},'models':{}}
bearings=[]
for index,spec in enumerate(choices):
    if 'pixel_files' in spec:
        family_bearings=[]
        for size in (30,22,18,16):
            src=root/'resources/fonts'/spec['pixel_files'].format(size=size)
            dest=root/'resources/fonts'/f'LoadingCatType{index}_{size}.ttf'
            shutil.copy2(src,dest)
            face=freetype.Face(str(dest));face.set_pixel_sizes(0,size);lefts=[];advances=[];heights=[]
            for char in '0123456789':
                face.load_char(char,freetype.FT_LOAD_RENDER|freetype.FT_LOAD_MONOCHROME|freetype.FT_LOAD_TARGET_MONO)
                lefts.append(face.glyph.bitmap_left);advances.append(face.glyph.advance.x//64);heights.append(face.glyph.bitmap.rows)
            assert len(set(advances))==1 and len(set(heights))==1,(spec['name'],size)
            family_bearings.append(lefts)
        bearings.append(family_bearings)
        continue
    font=TTFont(root/'resources/fonts'/spec['file'])
    if spec['weight'] is not None:
        font=instantiateVariableFont(font,{'wght':spec['weight']},inplace=True)
    # Use the designer's tabular alternates when available.
    substitutions={}
    if 'GSUB' in font:
        for feature in font['GSUB'].table.FeatureList.FeatureRecord:
            if feature.FeatureTag=='tnum':
                for lookup in feature.Feature.LookupListIndex:
                    for subtable in font['GSUB'].table.LookupList.Lookup[lookup].SubTable:
                        substitutions.update(getattr(subtable,'mapping',{}))
    for table in font['cmap'].tables:
        if table.isUnicode():
            for char in '0123456789':
                name=table.cmap.get(ord(char));table.cmap[ord(char)]=substitutions.get(name,name)
    options=subset.Options();options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
    sub=subset.Subsetter(options=options);sub.populate(text=chars);sub.subset(font)
    cmap=font.getBestCmap();digits=[cmap[ord(c)] for c in '0123456789']
    for name in font.getGlyphOrder():font['glyf'][name].recalcBounds(font['glyf'])
    ymin=min(font['glyf'][n].yMin for n in digits);ymax=max(font['glyf'][n].yMax for n in digits)
    advance=font['hmtx'][cmap[ord('0')]][0]
    sx=1024/advance;sy=2200/(ymax-ymin)
    metrics=dict(font['hmtx'].metrics);gs=font.getGlyphSet();new={}
    for name in font.getGlyphOrder():
        dx=(1024-metrics[name][0]*sx)/2 if name in digits else 0
        transform=(sx,0,0,sy,dx,-ymin*sy)
        if name==cmap[ord('°')]:
            g=font['glyf'][name];scale=640/(g.yMax-g.yMin)
            transform=(scale,0,0,scale,70-g.xMin*scale,1440-g.yMin*scale)
        recording=DecomposingRecordingPen(gs);gs[name].draw(recording);pen=TTGlyphPen(None)
        recording.replay(TransformPen(pen,transform));new[name]=pen.glyph()
    font['glyf'].glyphs=new
    for name in font.getGlyphOrder():
        g=font['glyf'][name];g.recalcBounds(font['glyf'])
        adv=1024 if name in digits else round(metrics[name][0]*sx)
        if name==cmap[ord('°')]:adv=g.xMax+80
        font['hmtx'][name]=(adv,getattr(g,'xMin',0))
    font['head'].unitsPerEm=2048
    font['hhea'].ascent,font['hhea'].descent,font['hhea'].lineGap=2200,0,0
    font['OS/2'].sTypoAscender,font['OS/2'].sTypoDescender,font['OS/2'].sTypoLineGap=2200,0,0
    font['OS/2'].usWinAscent,font['OS/2'].usWinDescent=2200,0
    font['OS/2'].sCapHeight=2200
    for record in font['name'].names:
        if record.nameID in (1,3,4,6,16):record.string=('LoadingCatType%d'%index).encode(record.getEncoding())
    dest=root/'resources/fonts'/('LoadingCatType%d.ttf'%index);font.save(dest)
    face=freetype.Face(str(dest));family_bearings=[]
    for size in (30,22,18,16):
        face.set_pixel_sizes(0,size);lefts=[];advances=[];tops=[];bottoms=[]
        for char in '0123456789':
            face.load_char(char,freetype.FT_LOAD_RENDER|freetype.FT_LOAD_MONOCHROME|freetype.FT_LOAD_TARGET_MONO)
            lefts.append(face.glyph.bitmap_left);advances.append(face.glyph.advance.x//64)
            tops.append(size-face.glyph.bitmap_top);bottoms.append(size-face.glyph.bitmap_top+face.glyph.bitmap.rows)
        assert len(set(advances))==1,(spec['name'],size,'Unequal digit spacing')
        assert max(tops)-min(tops)<=2 and max(bottoms)-min(bottoms)<=2,(spec['name'],size,'Unexpected vertical mismatch')
        family_bearings.append(lefts)
    bearings.append(family_bearings)
# Development-only raster references; these assets are not bundled in settings.
font_files=[(f'n{i}-{size}',root/'resources/fonts'/(f'LoadingCatType{i}_{size}.ttf' if 'pixel_files' in choices[i] else f'LoadingCatType{i}.ttf'),size) for i in range(len(choices)) for size in (30,22,18,16)]
font_files += [(f'rounded-{size}',root/'resources/fonts/Baloo2-ExtraBold.ttf',size) for size in (40,29,23)]
for key,path,size in font_files:
    face=freetype.Face(str(path));face.set_pixel_sizes(0,size);glyphs={}
    for char in chars:
        face.load_char(char,freetype.FT_LOAD_RENDER|freetype.FT_LOAD_MONOCHROME|freetype.FT_LOAD_TARGET_MONO)
        g=face.glyph;b=g.bitmap
        # Per-row bit strings are compact after the SDK's JS compression and can
        # be painted directly on Canvas with exact one-pixel glyph edges.
        pixels=[''.join('1' if b.buffer[y*b.pitch+x//8]&(0x80>>(x%8)) else '0' for x in range(b.width)) for y in range(b.rows)]
        glyphs[char]={'x':g.bitmap_left,'y':size-g.bitmap_top,'advance':g.advance.x//64,'rows':pixels}
    preview['fonts'][key]={'size':size,'glyphs':glyphs}
for platform in ('aplite','basalt','chalk','diorite','emery','flint','gabbro'):
    path=root/'resources/images'/('loadingcat_bg.png' if platform=='emery' else f'loadingcat_bg~{platform}.png')
    picture=Image.open(path).convert('RGB')
    if platform not in ('aplite','diorite','flint'):
        picture=picture.point(lambda channel:round(channel/85)*85)
    buf=io.BytesIO();picture.save(buf,format='PNG',optimize=True)
    preview['models'][platform]={'w':picture.width,'h':picture.height,'image':'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()}
(root/'tools/development').mkdir(exist_ok=True)
(root/'tools/development/preview-assets.json').write_text(json.dumps(preview,separators=(',',':'))+'\n')
header=['#pragma once','#include <stdint.h>','// Generated from the shipped font rasters.','static int stack_left_bearing(char digit,int size,int family) {',
        'static const int8_t bearings[%d][4][10] = %s;'%(len(choices),json.dumps(bearings,separators=(',',':')).replace('[','{').replace(']','}')),
        "if(digit<'0'||digit>'9')return 0;",'if(family<0 || family>=%d)family=0;'%len(choices),
        "return bearings[family][size==30?0:(size==22?1:(size==18?2:3))][digit-'0'];",'}',
        'static uint32_t numeral_resource(int family,int size) {','switch(family) {']
for i in range(len(choices)):
    header.append('case %d: return size==30?RESOURCE_ID_FONT_NUM_%s_30:(size==22?RESOURCE_ID_FONT_NUM_%s_22:(size==18?RESOURCE_ID_FONT_NUM_%s_18:RESOURCE_ID_FONT_NUM_%s_16));'%(i,*([chr(65+i)]*4)))
header+=['default:return RESOURCE_ID_FONT_NUM_A_22;','}','}']
(root/'src/c/font_metrics.h').write_text('\n'.join(header)+'\n')
runpy.run_path(str(root/'tools/generate_temperature_metrics.py'),run_name='__main__')
print('Prepared %d font families, fixed digit spacing and development raster assets.'%len(choices))
