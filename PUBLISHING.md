# Publishing Loading Cat Digital 1.5.1

This guide covers the local release preparation for version 1.5.1. No public repository or store listing has been created for this adaptation. Use the matching version in `verification.json` to confirm which release files have been checked.

## Original author credit and permission

Original Loading Cat watchface and supplied cat artwork: **zbw / zbzbw**, https://github.com/zbzbw/loadingcat-pebble. Digital adaptation: **jerechinsky**.

The upstream repository was checked on 2026-09-08. It has no license file and no general redistribution grant in its README. Its invitation to import, build and run the project does not clearly cover a derivative marketplace release. Public GitHub repositories may be viewed and forked, but that is distinct from redistribution permission. [GitHub licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).

Record the author's permission or applicable license in `UPSTREAM.md` before distribution. Confirm the supplied artwork is covered too. Preserve that permission and all existing notices in the source archive. Do not put a blanket license over the original work unless the permission permits it. A draft request is included with the release materials; it has not been sent.

## Store submission

For the current Pebble store, start at the [Pebble developer dashboard](https://developer.repebble.com/dashboard). The public store API links to this dashboard for uploading and managing apps. The authenticated submission form has not been inspected in this preparation.

1. Sign in with the account that should own the digital adaptation.
2. Create a watchface named **Loading Cat Digital**. Keep this adaptation separate from the original listing.
3. Upload `loading-cat-digital.pbw`, version **1.5.1**. It contains aplite, basalt, chalk, diorite, emery, flint and gabbro builds. Keep its existing UUID for subsequent updates.
4. Use the supplied `store-description.txt` and `release-notes.txt`. Retain the original author's credit and link. The digital adaptation's publisher is jerechinsky; do not impersonate the original author as the owner of this listing.
5. Add the PNG from each matching platform folder under `screenshots/`. These are native emulator screenshots with sample time and weather. Use them in platform screenshot fields, not a scaled comparison sheet.
6. Add the adaptation's actual public source URL after creating that repository. Do not use the upstream URL as if it hosted this version's source. Keep the upstream URL in the credit.
7. Review the saved listing, supported targets and release file, then publish after the permission issue is resolved.

The separate [Rebble developer portal](https://dev-portal.rebble.io/) also accepts watchfaces and PBWs. Its live form asks for the name, type, description, screenshots, website/source URL and release notes, then offers **Publish App to Store**. Use it if distributing through the Rebble store; it is a separate submission. A watchface banner is optional there. Do not rely on old instructions to email a ZIP to support.

## Before the public release

Version 1.5.1 uses one straight-stroke spinner with a white leading spoke and fading gray trail. Monochrome screens use a dithered fade. **Show seconds with spinner** is enabled by default: it makes one turn per minute, with a step every 7.5 seconds at eight spokes. Triggered spins temporarily take over and then return to the current seconds position. Turning seconds mode off keeps the spinner still between triggers. The spinner sits slightly lower on the forehead for stronger contrast; the original cat artwork is unchanged.

Listing copy should name the triggered motions **Fast spin** and **Slow loading**, the durations **2, 3 or 4 seconds**, and the four numeral typefaces **Teko**, **Bebas Neue**, **Square** and **Square Cut**. The default is a three-second Fast spin animation with eight spokes and Bebas Neue numerals. Slow loading makes one turn; Fast spin makes 32 advances, or four turns at the default spoke count. Available counts are 6, 7, 8 and 10.

Time is always shown as black stacked digits at the standard size. Optional temperature matches the pale-yellow background on color screens and uses white on monochrome screens, with a fixed black outline. Its outer spacing is balanced with the numeral-to-degree gap, while keeping the complete reading inside round screens. The 15 settings include font, time format, weather, animation and seconds choices, plus an optional gray nose on monochrome models. The gray nose is enabled by default and uses a steady ordered-dither pattern. Color models retain their original nose color. Removed layout, size and color controls must not appear in screenshots or listing copy.

The phone settings use the standard Clay form with only the 15 actual options and Save. There is no watchface preview or custom test/reset interface. Any supplied settings screenshot should show this current form.

The checks are documented in `README.md`; `verification.json` records the results and their version provenance. Version 1.5.1 has fresh captures on all seven emulator targets, settings and seconds-boundary checks, eight standard-size font captures across aplite and emery, and the stock-form UI checks. Native motion and seconds behavior is unchanged from 1.5.0, verified by comparison of the corresponding source regions. Spinner and temperature placement changes are checked in the fresh captures. The 1.5.0 coasting recordings and full-minute seconds checks are explicitly carried forward as earlier behavior evidence, not repeated claims or current-placement GIFs. The 24-combination spin timing and full-minute seconds host tests cover the timing formulas. Detailed font raster matching from 1.5.0 is earlier evidence for unchanged glyph shapes; the stock form has no watchface preview to compare against.

A real-phone check of settings delivery and location permission, a real wrist/backlight check, and normal use to assess battery life are still needed. Avoid claiming those hardware checks passed.

The weather API is Open-Meteo. This release uses its public endpoint without a key and includes attribution. Review its current [terms](https://open-meteo.com/en/terms) before commercial distribution or a change in usage scale.
