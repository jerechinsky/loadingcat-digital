# Battery audit - 1.5.6

The watchface follows Pebble's event-driven model. This audit checks unnecessary work, not physical battery runtime.

Changes:

- The spinner draws horizontal runs instead of individual pixels. Across 1,204 layout/palette/phase cases, the pixels match and drawing calls fall from 495,152 to 169,416 (65.8% fewer). This is not a battery-life percentage.
- Wrist-flick and backlight callbacks unsubscribe while disabled, at night when paused, or while the face is covered. Minute ticks restore them at the next active hour.
- The watch owns weather scheduling. Phone startup and unrelated settings changes no longer start their own weather fetch. Cached readings are not repeatedly sent; duplicate received readings neither redraw nor rewrite flash. Failed delivery retries only on a later request.
- Routine spin logging is removed. Hidden faces do not request redraws.
- The additional disconnect timer is removed. Pebble's own connection filter remains, with no Bluetooth polling.

Existing behavior retained:

- Minute ticks for the clock. Seconds use one-shot timers at spoke boundaries (every 7.5 seconds by default), not a one-second polling loop.
- A spin is bounded to 2–4 seconds. Losing focus cancels spin and seconds timers; repeated kicks replace the existing spin.
- Weather defaults to 30 minutes, uses cached coarse phone location with high-accuracy GPS disabled, and has five-minute retry throttling and bounded timeouts. Hiding temperature cancels pending HTTP work and suppresses location requests.
- No continuous accelerometer sampling, background worker, forced backlight, or low-latency Bluetooth mode. Vibrations are brief, optional and triggered only by a reported disconnect.
- Images/fonts are loaded once or when their settings/state change, then freed on unload. Settings write to storage only when changed. Input settings and weather values are validated.

Validation uses host lifecycle tests, a pixel-by-pixel spinner comparison, the stock settings form, seven SDK builds, and native emulator comparisons with 1.5.5. See the release's verification.json for completed checks.

Animations, seconds, Bluetooth and vibration still cost energy. Turning off seconds and animation gives the watch more time asleep. A reliable runtime figure requires a charge-cycle comparison on a real watch with comparable backlight, notifications and phone connectivity; no hardware battery improvement is claimed here.

Sources: [Pebble battery guidance](https://developer.rebble.io/guides/best-practices/conserving-battery-life/), [layer redraw behavior](https://developer.rebble.io/docs/c/User_Interface/Layers/). Pebble redraws the window's layer tree when a layer is marked dirty, so splitting it into layers alone would not avoid rendering work.
