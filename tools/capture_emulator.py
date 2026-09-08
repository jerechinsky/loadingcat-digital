#!/usr/bin/env python3
"""Capture the real installed app with the Pebble tool's Python environment.
Only uses a headless emulator; never connects to a physical watch.
Screenshots use fixed 12:30 / 22 C fixtures, not a real weather observation.
"""
import argparse, atexit, datetime, json, math, time, uuid
from pathlib import Path
from PIL import Image, ImageDraw
from libpebble2.communication import PebbleConnection
from libpebble2.services.appmessage import AppMessageService, Int32
from libpebble2.services.screenshot import Screenshot
from libpebble2.communication.transports.qemu.protocol import QemuTap, QemuButton
from pebble_tool.commands.emucontrol import send_data_to_qemu
from pebble_tool.commands.screenshot import ScreenshotCommand
from pebble_tool.sdk.emulator import ManagedEmulatorTransport

p = argparse.ArgumentParser()
p.add_argument('--platform', required=True)
p.add_argument('--output', type=Path, required=True)
p.add_argument('--animate', action='store_true')
p.add_argument('--shutdown', action='store_true')
p.add_argument('--settings-check', action='store_true')
p.add_argument('--font-check', action='store_true')
p.add_argument('--seconds-check', action='store_true')
args = p.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
root = Path(__file__).resolve().parents[1]
meta = json.loads((root / 'build/appinfo.json').read_text())
keys = meta['messageKeys']
transport = ManagedEmulatorTransport(args.platform, '4.33.1', True)
watch = PebbleConnection(transport)
watch.connect(); watch.run_async()
service = AppMessageService(watch)
_cleaned_up=False
def cleanup():
    global _cleaned_up
    if _cleaned_up:return
    _cleaned_up=True
    try:service.shutdown()
    finally:
        try:ScreenshotCommand._close_pebble_connection(watch)
        finally:
            if args.shutdown:ScreenshotCommand._shutdown_platform_emulator(args.platform,'4.33.1')
atexit.register(cleanup)
fixed = datetime.datetime.now().replace(hour=12, minute=30, second=10, microsecond=0)
ScreenshotCommand._set_time(watch, fixed)
time.sleep(.35)
ScreenshotCommand._set_time(watch, fixed)
time.sleep(.65)
acked, rejected = set(), set()
service.register_handler('ack', lambda tid, app_uuid: acked.add(tid))
service.register_handler('nack', lambda tid, app_uuid: rejected.add(tid))

def message(**data):
    tid = service.send_message(uuid.UUID(meta['uuid']), {keys[k]: Int32(v) for k,v in data.items()})
    deadline = time.monotonic() + 3
    while tid not in acked and tid not in rejected and time.monotonic() < deadline:
        time.sleep(.02)
    assert tid in acked, ('AppMessage not acknowledged', tid, data)
    time.sleep(.25)

def frame():
    rows = Screenshot(watch).grab_image()
    rows = ScreenshotCommand._correct_colours(None, rows)
    pic = Image.frombytes('RGB', (len(rows[0]) // 3, len(rows)), bytes(b for row in rows for b in row))
    if args.platform in ('chalk','gabbro'):
        mask = Image.new('L',pic.size); ImageDraw.Draw(mask).ellipse((0,0,pic.width-1,pic.height-1),fill=255)
        pic.putalpha(mask)
    return pic

defaults = dict(NUMERAL_FONT=2,SPIN_MOTION=1,SPOKES=8,SHOW_SPINNER=1,ANIMATE=1,FLICK_TRIGGER=1,LIGHT_TRIGGER=1,
                SPIN_LENGTH=0,TIME_FORMAT=0,LEADING_ZERO=1,SHOW_WEATHER=1,FAHRENHEIT=0,WEATHER_INTERVAL=30,GRAY_NOSE=1,SECOND_HAND=0)
message(**defaults)
report = {'platform':args.platform, 'version':meta['versionLabel'], 'fixtures':'12:30, 22 C', 'motions':{}}
for motion,name in enumerate(('slow','fast')):
    message(SPIN_MOTION=motion,SPOKES=8,TEMPERATURE=220,WEATHER_TIME=int(fixed.timestamp()))
    pic = frame(); pic.save(args.output / f'{args.platform}-{name}.png')
    if args.animate and args.platform == 'emery':
        frames=[pic.convert('RGB')]; times=[time.monotonic()]
        send_data_to_qemu(transport,QemuTap(axis=QemuTap.Axis.Y,direction=1))
        start=time.monotonic()
        while time.monotonic()-start < 4.2:
            frames.append(frame().convert('RGB')); times.append(time.monotonic())
            time.sleep(.02)
        durations=[max(20,round((times[i+1]-times[i])*1000)) for i in range(len(times)-1)]+[1000]
        # Preserve actual sampled timing; the pause is after the completed spin.
        frames[0].save(args.output/f'{name}-spin.gif',save_all=True,append_images=frames[1:],
                       duration=durations,loop=0,disposal=2)
        hashes=[hash(f.crop((40,20,140,110)).tobytes()) for f in frames]
        changes=[i for i in range(1,len(hashes)) if hashes[i]!=hashes[i-1]]
        unique=len(set(hashes));stable=len(set(hashes[-6:]))==1
        assert unique > 3, (name,'tap did not animate')
        assert stable, (name,'spinner did not stop')
        # SDK timer delivery and screenshot acquisition add bounded overhead to the
        # exact3s host schedule; keep the actual observed timing in the report.
        assert changes and 2800 <= (times[changes[-1]]-start)*1000 <= 3600,(name,'unexpected coast duration',round((times[changes[-1]]-start)*1000),len(changes),unique)
        print(json.dumps({'motion':name,'changes':len(changes),'last_ms':round((times[changes[-1]]-start)*1000),'unique':unique}),flush=True)
        if motion == 0:
            assert len(changes)==8,('Slow motion should advance only eight times',len(changes))
            assert (times[changes[0]]-start)*1000>=200,'Slow loading started too quickly'
        report['motions'][name]={'distinct_spinner_frames':unique,'stopped':stable,
            'observed_phase_changes':len(changes),'first_change_ms':round((times[changes[0]]-start)*1000),
            'last_change_ms':round((times[changes[-1]]-start)*1000)}
        time.sleep(.7)
if args.animate:
    assert report['motions']['fast']['observed_phase_changes']>report['motions']['slow']['observed_phase_changes']

# No minute/weather redraw is allowed to kick a settled spinner.
message(SPIN_MOTION=0,TEMPERATURE=220,WEATHER_TIME=int(fixed.timestamp()))
before=frame(); time.sleep(.8); after=frame()
assert before.tobytes()==after.tobytes(), 'idle frame unexpectedly changed'
report['idle_still']=True
report['idle_still_seconds_disabled']=True
# The gray nose is an optional fixed pixel pattern on monochrome, never a timer.
if args.platform in ('aplite','diorite','flint'):
    message(GRAY_NOSE=0);nose_off=frame();nose_off.save(args.output/f'{args.platform}-nose-off.png')
    message(GRAY_NOSE=1);nose_on=frame();nose_on.save(args.output/f'{args.platform}-nose-on.png')
    assert nose_off.tobytes()!=nose_on.tobytes(),'gray nose toggle had no effect'
    time.sleep(.5);assert nose_on.tobytes()==frame().tobytes(),'gray nose unexpectedly flickered'
    report['gray_nose_toggle']=True

if args.animate:
    # Wait out the OS backlight timeout, then exercise the actual Back event.
    time.sleep(7)
    before=frame()
    send_data_to_qemu(transport,QemuButton(state=1))
    time.sleep(.08)
    send_data_to_qemu(transport,QemuButton(state=0))
    captures=[]
    for _ in range(12): captures.append(frame()); time.sleep(.12)
    unique=len(set(x.crop((40,20,140,110)).tobytes() for x in captures))
    report['back_button_distinct_frames']=unique
    report['back_button_animated']=unique > 2
    assert report['back_button_animated'], 'Back wake did not animate'
    time.sleep(5)
    # Missing/stale data must be shown honestly, even after a previous good reading.
    ScreenshotCommand._set_time(watch, fixed + datetime.timedelta(hours=3))
    time.sleep(.35)
    ScreenshotCommand._set_time(watch, fixed + datetime.timedelta(hours=3))
    time.sleep(.65)
    message(SPIN_MOTION=0)
    frame().save(args.output/f'{args.platform}-stale-weather.png')
if args.settings_check:
    visible=frame()
    # Old messages must not restore the removed layouts or hide the clock.
    message(SHOW_TIME=0,TIME_LAYOUT=0,FONT_STYLE=1,COMPACT=1,DARK_TEXT=0,OUTLINE=0)
    assert visible.tobytes()==frame().tobytes(), 'legacy layout controls changed the fixed clock'
    report['legacy_layout_ignored']=True
    message(SHOW_SPINNER=0,SHOW_WEATHER=0)
    hidden=frame(); hidden.save(args.output/f'{args.platform}-clock-only.png')
    assert hidden.tobytes()!=visible.tobytes(), 'visibility settings did not take effect'
    send_data_to_qemu(transport,QemuTap(axis=QemuTap.Axis.Y,direction=1))
    time.sleep(1)
    assert hidden.tobytes()==frame().tobytes(), 'disabled spinner animated'
    message(SHOW_SPINNER=1,ANIMATE=0)
    still=frame()
    send_data_to_qemu(transport,QemuTap(axis=QemuTap.Axis.Y,direction=1))
    time.sleep(1)
    assert still.tobytes()==frame().tobytes(), 'disabled animation ran'
    message(ANIMATE=1,FLICK_TRIGGER=0,LIGHT_TRIGGER=0)
    still=frame()
    send_data_to_qemu(transport,QemuTap(axis=QemuTap.Axis.Y,direction=1))
    time.sleep(1)
    assert still.tobytes()==frame().tobytes(), 'disabled flick trigger ran'
    ScreenshotCommand._set_time(watch,fixed)
    time.sleep(.65)
    ScreenshotCommand._set_time(watch,fixed)
    time.sleep(.65)
    message(SHOW_TIME=1,SHOW_WEATHER=1,FAHRENHEIT=1,TEMPERATURE=220,WEATHER_TIME=int(fixed.timestamp()))
    frame().save(args.output/f'{args.platform}-fahrenheit.png')
    # Restore normal defaults for subsequent captures and the emulator's next launch.
    message(**defaults)
    report['feature_toggles_verified']=True
if args.font_check:
    fixed=fixed.replace(hour=16,minute=49)
    ScreenshotCommand._set_time(watch,fixed);time.sleep(.35)
    ScreenshotCommand._set_time(watch,fixed);time.sleep(.65)
    font_hashes=[]
    for family in (0,2,7,8):
        message(NUMERAL_FONT=family,TIME_FORMAT=2,SHOW_SPINNER=1,SHOW_WEATHER=1,FAHRENHEIT=0)
        time.sleep(.6)
        message(TEMPERATURE=310,WEATHER_TIME=int(fixed.timestamp()))
        pic=frame();pic.save(args.output/f'{args.platform}-font-{family}.png')
        font_hashes.append(pic.tobytes())
    assert len(set(font_hashes))==4, 'Some font selections did not change the watch'
    report['four_fonts_standard']=True
    message(**defaults)
# Typography/coasting fixtures above deliberately freeze the seconds trail at zero.
# Now check the live default's half-second boundary on every real target.
centers={'aplite':(73,49),'basalt':(73,49),'chalk':(116,56),'diorite':(73,49),
         'emery':(97,67),'flint':(73,49),'gabbro':(167,81)}
cx,cy=centers[args.platform]
scale={'aplite':74,'basalt':74,'chalk':85,'diorite':74,'emery':100,'flint':74,'gabbro':132}[args.platform]
radius=round(34*scale/100)
spinner_box=(cx-radius,cy-radius,cx+radius+1,cy+radius+1)
def spinner_hash(pic): return pic.crop(spinner_box).tobytes()
def set_second(second):
    fixture=fixed.replace(hour=12,minute=30,second=second,microsecond=0)
    ScreenshotCommand._set_time(watch,fixture);time.sleep(.2)
    ScreenshotCommand._set_time(watch,fixture)
    anchor=time.monotonic()
    time.sleep(.15)
    return anchor
message(SECOND_HAND=0,SPIN_MOTION=1,SPOKES=8,ANIMATE=0,LIGHT_TRIGGER=0)
set_second(0)
message(SECOND_HAND=1)
before=frame();time.sleep(8);after=frame()
assert spinner_hash(before)!=spinner_hash(after),'seconds did not cross the7.5s boundary'
report['seconds_boundary']=True

if args.seconds_check:
    assert args.platform=='emery','the full timing recording uses Time2 pixel probes'
    def observed_phase(pic):
        # Probe the middle of all eight strokes. The leading white stroke is followed
        # clockwise by a gray one; the other white stroke is the trailing highlight.
        whites=[]
        for i in range(8):
            vx=round(math.sin(i*math.pi/4)*1000);vy=round(-math.cos(i*math.pi/4)*1000)
            color=pic.getpixel((cx+int(vx*23/1000),cy+int(vy*23/1000)))[:3]
            if min(color)>230:whites.append(i)
        candidates=[i for i in whites if (i+1)%8 not in whites]
        assert len(whites)==2 and len(candidates)==1,('ambiguous trail',whites)
        return candidates[0]
    message(SECOND_HAND=0,SHOW_WEATHER=1,FAHRENHEIT=0,NUMERAL_FONT=2,TIME_FORMAT=2)
    anchor=set_second(0)
    message(SECOND_HAND=1,TEMPERATURE=220,WEATHER_TIME=int(fixed.replace(hour=12,minute=30,second=0).timestamp()))
    frames=[];sample_times=[];phases=[]
    while time.monotonic()-anchor<61.3:
        pic=frame().convert('RGB');stamp=time.monotonic()-anchor;phase=observed_phase(pic)
        frames.append(pic);sample_times.append(stamp);phases.append(phase)
        time.sleep(.25)
    changes=[i for i in range(1,len(phases)) if phases[i]!=phases[i-1]]
    sequence=[phases[0]]+[phases[i] for i in changes]
    assert sequence==[0,1,2,3,4,5,6,7,0],('seconds did not progress clockwise and wrap',sequence)
    change_times=[sample_times[i] for i in changes]
    assert all(abs(t-7.5*(i+1))<1.0 for i,t in enumerate(change_times)),change_times
    # Real elapsed timing, including the minute rollover. Never speed up this GIF.
    ticks=[round((stamp-sample_times[0])*100)*10 for stamp in sample_times]
    durations=[max(20,ticks[i+1]-ticks[i]) for i in range(len(frames)-1)]+[250]
    frames[0].save(args.output/'seconds-minute.gif',save_all=True,append_images=frames[1:],
                   duration=durations,loop=0,disposal=2)
    for phase in range(8):frames[phases.index(phase)].save(args.output/f'emery-seconds-{phase}.png')
    message(SECOND_HAND=0,ANIMATE=0)
    still=spinner_hash(frame());time.sleep(8)
    assert spinner_hash(frame())==still,'disabled seconds indicator still advanced'
    # A flick at :06 crosses the seconds boundary during its three-second coast.
    # When it ends it must rejoin phase1 (:07.5 through :15), not its starting phase0.
    set_second(6);message(SECOND_HAND=1,ANIMATE=1,FLICK_TRIGGER=1,LIGHT_TRIGGER=0)
    send_data_to_qemu(transport,QemuTap(axis=QemuTap.Axis.Y,direction=1))
    time.sleep(3.6)
    assert observed_phase(frame())==1,'flick did not return to current seconds position'
    # Hiding the entire spinner cancels its display updates even across a boundary.
    message(SHOW_SPINNER=0,ANIMATE=0);set_second(6)
    hidden=spinner_hash(frame());time.sleep(2.5)
    assert spinner_hash(frame())==hidden,'hidden seconds spinner changed the forehead'
    report['seconds_indicator']={'default_count':8,'seconds_per_spoke':7.5,
        'elapsed_seconds':round(sample_times[-1],3),'observed_phase_changes':len(changes),
        'phase_sequence':sequence,'change_times_seconds':[round(t,3) for t in change_times],
        'clockwise':True,'wrap':True,'interaction_returns_to_seconds':True,
        'animation_off_preserves_seconds':True,'hidden_cancels_visible_updates':True,
        'disabled_stays_still':True,'recording':'seconds-minute.gif','recording_speed':'real time'}
# Leave the installed watch on the actual shipping defaults.
message(**dict(defaults,SECOND_HAND=1))
print(json.dumps(report),flush=True)
(args.output/f'{args.platform}-verification.json').write_text(json.dumps(report,indent=2)+'\n')
cleanup()
