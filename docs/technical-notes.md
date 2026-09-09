Version 1.5.6 reduces spinner rendering calls, subscribes animation triggers only while useful, and makes the watch the sole weather scheduler. Duplicate readings no longer rewrite flash or request another redraw. The extra disconnect delay is retired and its old message key is reserved. See battery-audit.md for checks and limits.

Version 1.5.5 adds extra disconnect delay and an optional white cat on black. The original eyes and pupils are preserved with a thin dark outline; ears and gray details keep their natural colors. The background bitmap reloads and recolors only on visual state changes; original resources are unchanged. tools/generate_disconnect_eyes.py regenerates the eye drawing spans for all seven targets.

Version 1.5.4 adds optional disconnect vibrations, four patterns and an Ignore Quiet Time toggle. Pebble confirms sustained disconnects before notifying the face.

Most layout notes below describe version 1.5.1. Version 1.5.3 adds 12 spokes, adjustable nighttime animation pauses and live seconds alignment on repeated flicks. Credits now use yerex; the GitHub account stays jerechinsky. Current options and release checks are in README.md and PUBLISHING.md.

# Loading Cat Digital

A digital adaptation of [Loading Cat by zbw / zbzbw](https://github.com/zbzbw/loadingcat-pebble), retaining the original cat artwork and concept.

**Thanks to zbw / zbzbw for the original analog watchface and cat artwork.** This digital adaptation is by **yerex** ([jerechinsky on GitHub](https://github.com/jerechinsky)). [Visit the original project](https://github.com/zbzbw/loadingcat-pebble).

[Get it on the Pebble Store](https://apps.repebble.com/6f5289e6cd7f4ae7b666cb7f) · [Download the latest release](https://github.com/jerechinsky/loadingcat-digital/releases/latest)

![Loading Cat Digital on all seven platforms](all-models.png)

Version **1.5.1**.

- Stacked, straight-sided sans-serif hours and minutes with equal digit widths in the lower-left strip; follows the watch's 12/24-hour setting by default.
- Four numeral typefaces at the full, standard size, with Bebas Neue as the default. The black stacked clock stays visible against the pale background.
- Optional outdoor temperature in tall, pale-yellow numerals matching the cat background, tucked into the dark fur at the lower right. A fine black outline keeps it clear over the fur details. Uses Celsius and the phone's location. Monochrome screens use white.
- A bright white leading spoke and fading gray trail follow the seconds in discrete steps, making one turn each minute. This is enabled by default.
- A wrist flick starts a coasting animation, then the spinner returns to the current seconds position. Fast spin is the default, with a three-second duration. Another deliberate flick can give it a fresh kick.
- Monochrome models can show a gray nose using a steady pixel pattern; this is enabled by default. Color models retain the original nose color.
- Turn seconds mode off to keep the spinner still between triggered animations. With seconds mode off, no idle animation timer runs.

## Spinner motion

The spinner has one drawing: straight strokes with rounded ends, a clear opening in the middle and varied lengths. A bright white leading spoke and a gray trailing fade make its direction visible as the pattern moves around the forehead. Monochrome screens use a steady 4 x 4 ordered-dither pattern for the fade. Each frame advances one whole spoke position. At the eight-spoke default, the trail has two white spokes, two light-gray spokes and four dark-gray spokes. At Time 2 scale, the inner stroke endpoints sit 15 pixels from the center and stroke lengths vary from 12 to 16 pixels. The longest stroke endpoint is 31 pixels from the center (33 including the rounded cap).

| Motion | Movement |
| --- | --- |
| Fast spin | An immediate first step and 32 advances, slowing to a stop; four revolutions with eight spokes; the default |
| Slow loading | One revolution, starting gently and slowing to a stop |

Choose 6, 7, 8 or 10 spokes; the default is 8. Slow loading always makes one turn, while Fast spin's number of turns depends on the spoke count. Both motions offer 2, 3 or 4 seconds, with 3 seconds as the default.

**Show seconds with spinner** is enabled by default. Between triggered animations, the leading position tracks elapsed time within the minute. Eight spokes advance at exact 7.5-second boundaries; six spokes advance every 10 seconds and ten every 6 seconds. Seven spokes divide the minute into seven equal intervals. Each phase is calculated from the clock, so timer delays do not accumulate into drift. A wrist or backlight spin temporarily takes over, coasts down, then returns to the current seconds position. Turning this option off leaves the final spinner position still between triggered animations.

Both motions are included in one configurable PBW. The digital version has a new UUID, so it leaves the original watchface separate.

## Platforms

| Target | Watches | Display |
| --- | --- | --- |
| aplite | Pebble / Pebble Steel | 144 x 168, monochrome |
| basalt | Pebble Time / Pebble Time Steel | 144 x 168, color |
| chalk | Pebble Time Round | 180 x 180, round, color |
| diorite | Pebble 2 | 144 x 168, monochrome |
| emery | Pebble Time 2 | 200 x 228, color |
| flint | Pebble 2 Duo | 144 x 168, monochrome |
| gabbro | Pebble Round 2 | 260 x 260, round, color |

The stacked clock has equal visible left and bottom insets: 4 pixels on the small rectangular screens and 5 pixels on Time 2. Round models move the corner diagonally inward, with equal 30-pixel insets on Time Round and 42-pixel insets on Round 2, so the digits stay inside the circular screen.

Temperature moves outward to balance the visible gap after the degree symbol with the gap between the final numeral and the degree symbol. Placement uses the selected font and size. Rectangular models match those gaps; round models use the closest position that keeps the entire outlined temperature inside the curved screen edge. Its vertical position is unchanged.

The original-size cat bitmap shifts right by 7 pixels on rectangular screens, or 34/48 pixels on Time Round/Round 2. The spinner shares that horizontal translation and sits slightly lower on the forehead for contrast against the black fur. The original artwork is unchanged and is clipped by the screen edge, with no stretching. Smaller displays use smaller font resources. Font subsets contain only the required digits and punctuation.

Version 1.5.1 returns the spinner to the preferred lower placement: 5 pixels below the original on small rectangular models, 7 on Time Round, 8 on Time 2 and 10 on Round 2. These vertical offsets are intentional; the cat has not moved vertically. The original centers, from upstream commit `0905b4f97d3d458831ac0fb9b724978bb84244fc`, are reference coordinates: (66,44), (82,49), (90,59) and (119,71) respectively, before the shared horizontal shift. All seven background PNGs remain byte-identical to that commit. The lower placement puts more of the pale strokes over black fur without changing their lengths. The longest Time 2 endpoint remains 31 pixels from the center, or 33 including the rounded cap; the original analog base and minute-hand endpoints are 36 and 40 pixels out. Seconds mode and triggered coasting are unchanged.

## Wrist flick and Back

The accelerometer tap service handles wrist flicks on every target. It detects a sharp movement, not every gentle raise-to-view motion. Actual sensitivity needs checking on a physical watch.

Stock PebbleOS reserves watchface button handling for the system. On targets where the SDK provides the backlight event service (emery, flint and gabbro with compatible firmware), the watchface also animates when the backlight changes from off to on. This covers Back waking the light. It also covers other backlight activations while the face is visible, and another Back press while the light is already on cannot be detected. The legacy targets use wrist flick only.

Flick and backlight events within 650 ms are merged into one kick. Coasting and seconds updates stop when the face loses focus. Regaining focus resumes the current seconds position when enabled and does not itself trigger a coasting animation.

## Weather and privacy

Weather comes from [Open-Meteo](https://open-meteo.com/) using its `temperature_2m` current conditions. It is outdoor weather for the phone's location, not a temperature sensor in the watch. Allow location access in the companion app.

Coordinates are rounded to two decimal places (roughly 1 km) before being sent over HTTPS to Open-Meteo. They are not logged or saved by this watchface. Only the temperature and observation time are cached on the phone and watch.

The watch asks for an update after launch and when the observation is at least 30 minutes old by default; settings also offer 15 or 60 minutes. Failures are throttled to one attempt per five minutes. Cached readings remain visible for at most two hours; without a fresh reading the display says `--°`. Offline and denied-location cases never invent a temperature. Example screenshots use sample temperatures, not live conditions.

Weather data: Open-Meteo, [CC BY 4.0 attribution information](https://open-meteo.com/en/license). Check their API usage terms before any commercial release.

## Build

Requires a recent Pebble SDK with all seven platform definitions. Developed using Pebble Tool 5.0.40 and SDK 4.33.1.

```sh
pebble build
pebble install --emulator emery --vnc
```

The PBW appears in `build/loadingcat-pebble.pbw`. One bundle includes all seven targets and both motions.

## Settings

Open the watchface's gear icon in the Pebble phone app. The page is embedded in the app and works offline; it uses a vendored, unchanged JavaScript build of Pebble Clay 1.0.4. The original Clay package's platform list predates flint and gabbro, so only its platform-independent JavaScript is bundled here.

The page contains 15 settings:

- Show/hide the spinner; choose 6, 7, 8 or 10 spokes.
- Show seconds with the spinner, enabled by default; turning it off keeps the resting spinner still.
- **Animate on interaction** controls wrist/backlight coasting independently of seconds mode. Wrist-flick and backlight triggers can each be enabled or disabled.
- Fast spin or Slow loading motion, lasting 2, 3 or 4 seconds.
- Teko, Bebas Neue, Square or Square Cut numerals.
- Follow-watch, 12-hour or 24-hour time format; leading zero.
- Show/hide temperature; Celsius/Fahrenheit; 15/30/60-minute weather refreshes.
- Gray nose on monochrome models, enabled by default. Turning this off restores the original monochrome artwork. The gray is a fixed ordered-dither pattern, with no extra animation timer.

The clock is always stacked, black and standard size, with no outline. Temperature is pale yellow on color screens and white on monochrome screens, with a fixed black outline. These colors keep the clock readable on the pale background and the temperature readable on the cat's fur.

Defaults are Bebas Neue numerals, eight spokes showing seconds, both available triggers, a three-second Fast spin animation, and Celsius refreshed every 30 minutes. Settings persist on the watch and phone. Turning temperature off also prevents new location and weather requests. Saving settings redraws the face without starting a coasting animation. No settings page is hosted externally.

Upgrading keeps valid font, weather, time-format and motion preferences. Retired layout, visibility, size and color settings are ignored. Saved 12-spoke or automatic counts become eight spokes. New installations use the current defaults.

The settings page is the standard Pebble Clay form with these 15 options and a Save button. Controls that do not apply to the chosen settings or watch model are hidden. There is no embedded watchface preview, example-time field, test-animation button or custom reset interface. Changes are sent to the watch after Save.

Turning weather off also aborts an active weather HTTP request and invalidates late location callbacks. It does not erase the last cached reading, which is still subject to the two-hour age limit if weather is enabled again.

## Validation

```sh
node tests/weather.test.js
clang -std=c11 -Wall -Wextra -Werror tests/spin_math.c -o /tmp/loading-cat-spin-check
/tmp/loading-cat-spin-check
clang -std=c11 -Wall -Wextra -Werror tests/seconds_math.c -o /tmp/loading-cat-seconds-check
/tmp/loading-cat-seconds-check
```

`tests/spin_math.c` runs on the host with strict Clang warnings. It checks all 24 combinations of four spoke counts, three durations and two motions: exact elapsed time, progressively longer delays, phase wraparound in both directions and the distinct slow/fast startup.

`tests/seconds_math.c` checks every millisecond across a minute for all four spoke counts, including exact 7.5-second boundaries at eight spokes, minute rollover and positive delays to the next boundary. It also checks 100 minutes of seven-spoke timing without accumulated rounding drift.

`tools/capture_emulator.py` runs through the Pebble tool's Python environment and captures the real installed face. It uses a headless emulator and sample time/temperature, never a physical watch. With `--animate` on emery it records Slow loading and Fast spin, checks their coasting behavior, checks the idle frame with seconds disabled, exercises Back, and captures expired-weather behavior. `--settings-check` additionally verifies feature toggles and captures time-format and unit settings. `--font-check` switches all four fonts at the standard size. On emery, `--seconds-check` records a full minute in real time, verifying all eight seconds positions and the minute rollover, return to the current seconds phase after a triggered spin, continued seconds movement with interaction animation off, and a still frame when seconds mode is off.

`node tests/settings-ui.test.js` verifies the stock Clay form: all 15 settings and their choices, conditional visibility and model capabilities across seven targets, offline operation and save/reopen. It also checks that custom preview controls are absent. It requires Playwright and Chromium; `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `PREVIEW_OUTPUT` can point at an existing runtime and output directory.

For 1.5.1, fresh native emulator captures check the lower placement on all seven targets, seconds-boundary updates, settings behavior and all four fonts on aplite and emery. Fresh stock-form tests cover 320, 390 and 480-pixel widths. `tests/temperature_capture.py` also measures 15 native temperature captures: the two visible gaps match on rectangular screens and the full glyphs remain inside round screens.

The detailed 1.5.0 motion recordings, full-minute seconds check and font raster comparisons are retained as earlier evidence for unchanged animation/seconds behavior and glyph shapes. Those older checks were not repeated, and their recordings are not presented as current-placement animation demos. The release verification distinguishes fresh checks from this carry-forward evidence.

Build/emulator checks do not verify physical wrist sensitivity, phone permission prompts, phone-to-watch delivery, or battery life on hardware.

## Credits and redistribution

Original watchface and cat assets: **zbw / zbzbw**, [loadingcat-pebble](https://github.com/zbzbw/loadingcat-pebble). Digital adaptation by **yerex** ([jerechinsky on GitHub](https://github.com/jerechinsky)). The original author remains credited in the manifest.

Numeral choices: **Teko**, **Bebas Neue**, **Square** and **Square Cut**. Bebas Neue is the default.

Teko and Bebas Neue preserve their designed outlines and equal-width numeral cells. Square and Square Cut are original geometric designs for this project, with flat shoulders on 1 and rectangular counters in 0, 6 and 9. Their stroke widths are aligned separately for each small pixel size. Numerals within each size have identical heights. Square Cut trims outer corners but keeps the inner walls straight. The slanted 7 distinguishes it from the flat-shouldered 1.

Third-party font sources and licenses are listed in `THIRD_PARTY_NOTICES.md`. Regenerate the font resources, metrics and development raster assets with `python3 tools/generate_tall_font.py` (requires fonttools, freetype-py and Pillow). It also runs `tools/generate_square_fonts.py`, the source geometry for Square and Square Cut.

Settings framework: **Pebble Clay 1.0.4**, Pebble Technology, MIT license in `src/pkjs/vendor/CLAY-LICENSE.txt`.

Retained font-study source: **Baloo 2**, the Baloo 2 Project Authors / Ek Type, from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/baloo2). Included under the SIL Open Font License in `resources/fonts/OFL.txt`; the ExtraBold file is an 800-weight instance of the upstream variable font.

The upstream watchface repository did not include a license file when copied. This adaptation does not claim a license grant for the original code or artwork. The public fork and store listing retain the original author's credit; publication does not establish a license grant. See `UPSTREAM.md` for the recorded status.

Publishing instructions and current permission status: `PUBLISHING.md`. Weather data handling: `PRIVACY.md`.

## 1.5.7: custom weather location

The stock form now has 24 settings. Weather location defaults to Phone location; Custom city reveals a text field with `Prague, CZ` as its example. City text is normalized and kept on the phone. The companion resolves the city with Open-Meteo's country-filtered Geocoding API, caches the rounded city coordinates for 30 days and uses the existing weather refresh schedule. Custom mode never requests phone GPS, including when the input is empty or the lookup fails.

Temperature caches belong to a location. The watch receives a numeric location identity with settings and each weather response, clears its reading when that identity changes, and ignores stale responses from a different source. Legacy caches and responses without an identity are valid only in phone mode. Changing source cancels pending HTTP work and invalidates late callbacks; turning weather off stops both lookup and forecast requests.

`tests/weather.test.js` checks normalization, city lookup and cached coordinates, failures, location switches during GPS/lookup/forecast, hidden preferences and phone-only text storage. `tests/power_lifecycle.py` checks native cache invalidation and matching responses. `tools/capture_emulator.py --location-check --direct` exercises both directions of location switching in a headless native emulator. These checks do not verify real-phone permission prompts or physical-watch delivery.

## 1.5.8: local city names

Country aliases USA/UK/GBR/CZE/UKR/CHN/JPN normalize to two-letter codes. Full-width ASCII and Japanese commas normalize too, while city scripts and diacritics are preserved. The companion selects a matching lookup language for non-Latin scripts. Two-character Japanese names first search as written, then try the municipal suffix (市, or 都 for 東京) if no populated-place match is found. This fallback is bounded to one extra lookup, only on an empty result. HTTP errors do not trigger it. Existing cache, cancellation, weather-off and retry limits still apply.

The city database does not contain every nickname or spelling. The settings hint recommends a full city name or English spelling when no match is found.

## 1.5.9: reconnect vibration

The settings form now has 26 options. Reconnect vibration is independently enabled and uses its own pattern selection; its defaults are off and Short tap. Disconnect defaults and saved choices are preserved. Both alerts use the existing connection callback, suppress duplicate state reports and honor the shared Quiet Time preference. No polling or timer was added. Reconnect still restores normal colors regardless of vibration settings.

The custom city hint now explicitly introduces its sample locations with "For example".

## 1.6.0: place search and broader name coverage

The stock Clay form keeps 26 visible preferences and adds a Find place button and a result list. A hidden, phone-only WEATHER_PLACE field stores the confirmed GeoNames ID, labels, input and rounded coordinates. It is never sent to the watch. Selected places bypass further geocoding. Changes to the entered name invalidate the selection; switching places changes the weather-cache identity and rejects late replies from the previous location.

The same ES5 location module runs in the companion and settings page. Searches use the input script, the country's local language, the phone language and English, with at most four requests. Japanese, Korean and Taiwanese city suffixes and German umlaut transliterations receive bounded handling. Names and country codes retain the earlier normalization; an optional middle region qualifier is passed to the API. Result labels include the city, district where available, region and country. Explicit selection accepts the chosen populated place; unattended lookups reject prefix-only and ambiguous exact results. Existing city cache identities change once to discard potentially incorrect old matches.

Place search happens only after Find place is pressed. Hiding weather or custom mode, changing the name, leaving the page and a 30-second deadline all cancel pending searches. HTTP failures show a short error and never trigger GPS. Watch scheduling, connection handling, artwork and animation are unchanged.

The live suite in `tests/location-live.test.js` covers 63 public inputs, including village names, diacritics, multiple scripts, abbreviations and regional qualifiers. It checks known GeoNames IDs and verifies safe no-result cases too. It is opt-in because it contacts Open-Meteo. The database still lacks some native names, including the Tamil spelling of Chennai in this run; English Chennai works. This is not a claim that every name or language is covered.

`tests/place-picker.test.js` checks the actual shipped settings bundle with controlled responses: explicit search, same-name towns, region/country labels, selection and save/reopen, cancellation, hidden controls and network/response errors. The existing weather and settings tests also cover the added saved-place data. No analytics were added.

The backlight hint now explicitly says Back button. Pebble exposes an on/off backlight event with no activation reason. A wrist flick that turns the light on can still trigger the backlight option when the separate flick option is disabled; both triggers must be off for seconds-only behavior. No unreliable motion-based guess was added.

## 1.6.1: inline neighborhood suggestions

The Find place button and select dropdown are replaced by a free-form search field and up to five tappable results. Photon / OpenStreetMap supplies city, district, locality and county results; shops, buildings and roads are filtered out. Country codes are optional, and district/city/country labels remain visible so mismatched names can be noticed. Results show their district, city and country rather than assuming the first match is correct.

Search waits 900 ms after input, defers while IME composition is active, cancels obsolete requests and uses a 10-second HTTP timeout. Twenty queries can be cached in the current page. A 429 response delays subsequent requests by 10 seconds. Opening settings does not search. Hiding custom mode or weather, leaving the page and editing the query cancel pending requests. No GPS bias or extra watch polling is used.

Photon selections use namespaced OpenStreetMap IDs (`osm:N:...`, `osm:W:...`, `osm:R:...`) and the existing rounded-coordinate cache identity. Older GeoNames selections and the old city/country fallback remain valid. Free-form input without a chosen result never silently selects a location. Forecast scheduling, watch code and artwork are unchanged.

`tests/neighborhood-live.test.js` verifies 10 public city/neighborhood/village queries against expected coordinates. The updated `tests/place-picker.test.js` checks the shipped bundle's debounce, composition events, page cache, tappable results, preservation across Save/reopen, cancellation, network errors and mobile layout. It also verifies a real Photon search from the embedded data-URI settings page. The previous 63-case GeoNames live test is retained for the unchanged legacy lookup, not presented as Photon coverage.

### Version 1.6.3: concise settings

Time settings appear first. Shorter labels and hints keep the stock Clay form compact; detailed attribution and privacy information are linked from the footer. Empty place-search status rows are hidden. All options, defaults and saved values are preserved.
