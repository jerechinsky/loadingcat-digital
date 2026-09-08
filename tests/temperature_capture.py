#!/usr/bin/env python3
"""Find actual degree glyphs in emulator captures and verify visible edge spacing."""
from pathlib import Path
from collections import Counter
import json
from PIL import Image

root=Path(__file__).resolve().parents[1]
fonts=json.loads((root/'tools/development/preview-assets.json').read_text())['fonts']
models=('aplite','basalt','chalk','diorite','emery','flint','gabbro')
cases=[(model,2,'22',f'{model}-fast.png') for model in models]
cases += [(model,family,'31',f'{model}-font-{family}.png') for model in ('aplite','emery') for family in (0,2,7,8)]
results=[]
for model,family,value,name in cases:
    im=Image.open(root.parent/'previews'/name).convert('RGBA');w,h=im.size
    big=w>=200;round_screen=model in ('chalk','gabbro');size=22 if big else 18
    margin=(42 if big else 30) if round_screen else (5 if big else 4)
    glyphs=fonts[f'n{family}-{size}']['glyphs'];degree=glyphs['°'];last=glyphs[value[-1]]
    y=h-margin-size+degree['y'];rows=degree['rows'];gw=len(rows[0]);gh=len(rows)
    cream=Counter(p[:3] for p in im.getdata() if p[3] and p[0]>200 and p[1]>200).most_common(1)[0][0]
    mask={(x,yy) for yy,row in enumerate(rows) for x,pixel in enumerate(row) if pixel=='1'}
    outline={(x+dx,yy+dy) for x,yy in mask for dx in (-1,0,1) for dy in (-1,0,1)}-mask
    candidates=[]
    for x in range(w//2,w-gw+1):
        if all(im.getpixel((x+dx,y+dy))[:3]==cream and im.getpixel((x+dx,y+dy))[3] for dx,dy in mask):
            if all(0<=x+dx<w and 0<=y+dy<h and im.getpixel((x+dx,y+dy))[:3]==(0,0,0) and im.getpixel((x+dx,y+dy))[3] for dx,dy in outline):candidates.append(x)
    assert len(candidates)==1,(name,'cannot uniquely locate outlined degree glyph',candidates)
    degree_left=candidates[0];box_y=y-degree['y']
    last_origin=degree_left-degree['x']-last['advance']
    last_ink={(x,yy) for yy,row in enumerate(last['rows']) for x,pixel in enumerate(row) if pixel=='1'}
    for dx,dy in last_ink:
        point=(last_origin+last['x']+dx,box_y+last['y']+dy)
        p=im.getpixel(point)
        assert p[3] and p[:3]==cream,(name,'last numeric glyph differs or is clipped',point,p)
    last_right=last_origin+last['x']+max(x for x,yy in last_ink)
    degree_right=degree_left+max(x for x,yy in mask)
    inner_gap=degree_left+min(x for x,yy in mask)-last_right-1
    edge_gap=w-1-degree_right
    if not round_screen:assert edge_gap==inner_gap,(name,'visible gaps differ',edge_gap,inner_gap)
    results.append(dict(capture=name,platform=model,font=family,temperature=value+'°',number_to_degree_px=inner_gap,
                        degree_to_rectangular_edge_px=edge_gap,exact_gap_match=not round_screen,degree_and_last_digit_unclipped=True))
report=dict(captures=len(results),all_rectangular_gaps_match=True,all_captured_glyphs_unclipped=True,results=results)
output=root.parent.parent/'work/lower-spinner/temperature-capture.json'
output.write_text(json.dumps(report,indent=2)+'\n')
print(f'{len(results)} native temperature captures passed: equal rectangular gaps and unclipped round glyphs.')
