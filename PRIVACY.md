# Loading Cat Digital privacy

Weather is optional. Turning **Show temperature** off stops location, city lookup and weather requests. It cancels an active HTTP request and ignores late callbacks from a location request already in progress.

**Phone location** is the default. The Pebble companion app obtains the phone's location and rounds latitude and longitude to two decimal places, approximately kilometre precision. These phone coordinates are not logged or stored.

**Custom place** does not request the phone's location. When you pause typing for 0.9 seconds, the settings page sends your search text to Photon, a place-search service run by komoot using OpenStreetMap data. Pressing the keyboard's Search/Enter key searches immediately. Photon receives the query and normal connection information, including your IP address. It receives no watch or account identifier from this adaptation. See [Photon's service information](https://photon.komoot.io/).

The results show neighborhoods, cities, regions and countries. Only the place you tap is selected. Its labels, OpenStreetMap identifier and rounded coordinates are saved on the phone and reused for weather without further geocoding. Changing the search text clears the previous selection. Recent search results are cached only within the open settings page. Closing the page or hiding weather/custom mode cancels pending searches.

Older saved city-and-country entries without a selected result retain the Open-Meteo/GeoNames lookup, accepting only unambiguous exact names and caching coordinates for up to 30 days. Unselected free-form text does not trigger GPS or silently choose a place.

Both modes send the rounded coordinates over HTTPS to Open-Meteo for outdoor temperature. Open-Meteo also receives normal connection information, including the originating IP address. See [Open-Meteo's privacy information](https://open-meteo.com/en/terms).

Preferences, the last temperature and its observation time are stored on the phone and watch. City text and coordinates stay on the phone; the watch receives a numeric location identifier to avoid displaying weather from a previous location. Changing location clears the displayed reading. Cached readings older than two hours show `--°`. Disabling weather retains preferences and cached data but stops requests.

The settings form is embedded in the app and works offline. Place search and weather need internet. There is no analytics or account service added by this adaptation.
