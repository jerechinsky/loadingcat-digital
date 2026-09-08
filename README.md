# Loading Cat Digital

a digital variant of ["loading cat" by zbw / zbzbw](https://github.com/zbzbw/loadingcat-pebble). really like the original, just wanted a digital clock too. thanks to zbw for the watchface and cat artwork!

[pebble store](https://apps.repebble.com/6f5289e6cd7f4ae7b666cb7f) · [download](https://github.com/jerechinsky/loadingcat-digital/releases/latest)

![Loading Cat Digital on all seven platforms](docs/all-models.png)

- **time:** stacked hours and minutes. four fonts: Bebas Neue, Teko, Square and Square Cut. follows the watch's time format, or choose 12/24-hour and a leading zero.
- **temperature:** optional local weather from your phone's location, in °C or °F. refresh every 15, 30 or 60 minutes. turning it off stops location and weather requests.
- **seconds:** the spinner makes one turn per minute. choose 6, 7, 8 or 10 spokes; timing adjusts automatically. seconds mode can be switched off.
- **animation:** flick your wrist for a spin that slows down. choose slow or fast, lasting 2, 3 or 4 seconds. default is fast, 3 seconds, 8 spokes. the spinner, animation and individual triggers can be switched off.
- **backlight trigger:** can also spin when the backlight wakes on Time 2, 2 Duo and Round 2 with compatible firmware.
- **monochrome:** dithered spinner shading and an optional gray nose.

works on Pebble, Steel, Time, Time Steel, Time Round, Pebble 2, Time 2, 2 Duo and Round 2. settings work offline and keep your preferences. weather needs internet; stale readings disappear after two hours.

build with the Pebble SDK:

```sh
pebble build
```

adapted by **yerekhinsky** (jerechinsky on GitHub). weather: [Open-Meteo](https://open-meteo.com/), CC BY 4.0. fonts and Clay: [credits and licenses](THIRD_PARTY_NOTICES.md). [upstream license status](UPSTREAM.md) · [privacy](PRIVACY.md) · [technical notes](docs/technical-notes.md)
