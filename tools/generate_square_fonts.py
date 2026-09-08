#!/usr/bin/env python3
"""Draw original Cat Square numeral outlines on each Pebble size pixel grid."""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
import freetype,json
root=Path(__file__).resolve().parents[1]
out=root/'resources/fonts'
def contours(rectangles):
 cells=set()
 for x0,y0,x1,y1 in rectangles:
  for x in range(x0,x1):
   for y in range(y0,y1):cells.add((x,y))
 edges={}
 for x,y in sorted(cells):
  for absent,a,b in [((x,y-1),(x,y),(x+1,y)),((x+1,y),(x+1,y),(x+1,y+1)),((x,y+1),(x+1,y+1),(x,y+1)),((x-1,y),(x,y+1),(x,y))]:
   if absent not in cells:edges[a]=b
 result=[]
 while edges:
  first=next(iter(edges));cur=first;points=[]
  while True:
   points.append(cur);cur=edges.pop(cur)
   if cur==first:break
  cleaned=[]
  for i,p in enumerate(points):
   a=points[i-1];b=points[(i+1)%len(points)]
   if (p[0]-a[0])*(b[1]-p[1]) != (p[1]-a[1])*(b[0]-p[0]):cleaned.append(p)
  result.append(cleaned)
 return result


for clipped in (False,True):
 name='CatSquareCut' if clipped else 'CatSquare'
 fonts={}
 for size in (30,22,18,16):
  advance=size//2; W=advance-2; H=round(size*2200/2048); S=max(2,round(size/10)); M=(H-S)//2
  def R(x0,y0,x1,y1): return (x0,y0,x1,y1)
  top=R(0,H-S,W,H);mid=R(0,M,W,M+S);bottom=R(0,0,W,S)
  left=R(0,0,S,H);right=R(W-S,0,W,H);lefttop=R(0,M,S,H);leftbottom=R(0,0,S,M+S);righttop=R(W-S,M,W,H);rightbottom=R(W-S,0,W,M+S)
  stem=(W-S)//2
  D=max(4,round(size*.28));Y=round(H*.69)
  rects={'0':[top,bottom,left,right], '1':[R(stem,0,stem+S,H),R(0,H-S,stem+S,H)],
    '2':[top,mid,bottom,righttop,leftbottom],'3':[top,mid,bottom,right],
    '4':[mid,lefttop,right],'5':[top,mid,bottom,lefttop,rightbottom],
    '6':[top,mid,bottom,left,rightbottom],'7':[top]+[R(round((W-S)*y/(H-S)),y,round((W-S)*y/(H-S))+S,y+1) for y in range(H-S)],
    '8':[top,mid,bottom,left,right],'9':[top,mid,bottom,lefttop,right],
    '-':[R(0,M,W,M+S)],':':[R(1,round(H*.25),1+S,round(H*.25)+S),R(1,round(H*.7),1+S,round(H*.7)+S)],
    '°':[R(0,Y,D,Y+1),R(0,Y+D-1,D,Y+D),R(0,Y,1,Y+D),R(D-1,Y,D,Y+D)]}
  # Each source uses an integer pixel grid at its intended Pebble size.
  # 64 font units become exactly one rendered pixel, avoiding unequal stems
  # caused by scaling one half-pixel outline across the four small sizes.
  fb=FontBuilder(size*64,isTTF=True);order=['.notdef']+[('degree' if c=='°' else 'colon' if c==':' else 'hyphen' if c=='-' else 'n'+c) for c in rects]
  fb.setupGlyphOrder(order);fb.setupCharacterMap({ord(c):n for c,n in zip(rects,order[1:])});glyphs={};metrics={}
  empty=TTGlyphPen(None);glyphs['.notdef']=empty.glyph();metrics['.notdef']=(advance*64,0)
  for char,n in zip(rects,order[1:]):
   pen=TTGlyphPen(None)
   for points in contours(rects[char]):
    path=[]
    for i,p in enumerate(points):
     a=points[i-1];b=points[(i+1)%len(points)];cross=(p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0])
     if clipped and cross>0 and char.isdigit() and char not in ('1','7'):
      from math import hypot
      u=hypot(a[0]-p[0],a[1]-p[1]);v=hypot(b[0]-p[0],b[1]-p[1]);t=min(1.5,u/2,v/2)
      path.extend([(p[0]+(a[0]-p[0])/u*t,p[1]+(a[1]-p[1])/u*t),(p[0]+(b[0]-p[0])/v*t,p[1]+(b[1]-p[1])/v*t)])
     else:path.append(p)
    path=[(round((1+x)*64),round(y*64)) for x,y in path]
    pen.moveTo(path[0])
    for p in path[1:]:pen.lineTo(p)
    pen.closePath()
   glyphs[n]=pen.glyph();metrics[n]=((advance if char.isdigit() or char=='-' else D+2 if char=='°' else S+3)*64,(1+min(r[0] for r in rects[char]))*64)
  fb.setupGlyf(glyphs);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=H*64,descent=0,lineGap=0)
  fb.setupNameTable({'familyName':name,'styleName':'Regular','uniqueFontIdentifier':name+'-'+str(size)+'-1.0','fullName':name,'psName':name+str(size),'version':'Version 1.0','copyright':'Original geometric numerals prepared for Alex, 2026.'})
  fb.setupOS2(sTypoAscender=H*64,sTypoDescender=0,sTypoLineGap=0,usWinAscent=H*64,usWinDescent=0,sCapHeight=H*64)
  fb.setupPost();fb.setupMaxp();dest=out/(name+'_'+str(size)+'.ttf');fb.save(dest)
  face=freetype.Face(str(dest));face.set_pixel_sizes(0,size);glyphdata={}
  for c in rects:
   face.load_char(c,freetype.FT_LOAD_RENDER|freetype.FT_LOAD_MONOCHROME|freetype.FT_LOAD_TARGET_MONO);g=face.glyph;b=g.bitmap
   glyphdata[c]={'x':g.bitmap_left,'y':size-g.bitmap_top,'advance':g.advance.x//64,'rows':[''.join('1' if b.buffer[y*b.pitch+x//8]&(0x80>>(x%8)) else '0' for x in range(b.width)) for y in range(b.rows)]}
  fonts[str(size)]={'size':size,'glyphs':glyphdata}

 print('Created',name,'at four pixel sizes')
