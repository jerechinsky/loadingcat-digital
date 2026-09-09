# Loading Cat Digital privacy

Weather is optional. Turning **Show temperature** off stops location, city lookup and weather requests. It cancels an active HTTP request and ignores late callbacks from a location request already in progress.

**Phone location** is the default. The Pebble companion app obtains the phone's location and rounds latitude and longitude to two decimal places, approximately kilometre precision. These phone coordinates are not logged or stored.

**Custom city** does not request the phone's location. Tapping **Find place** sends the entered name and country (and optional region) to Open-Meteo's city lookup service, which uses GeoNames data. It makes at most four requests per search to handle local names. Typing and opening settings do not start a search. The results show city, region and country; your selection and rounded coordinates are saved on the phone and reused for weather without further geocoding.

If you save a city without selecting a result, the companion accepts only a single exact name match among the returned populated places. It caches that lookup for up to 30 days. Ambiguous or unmatched names show `--°`; use Find place to choose the right town. Changing the entered name clears any previous selection.

Both modes send the rounded coordinates over HTTPS to Open-Meteo for outdoor temperature. Open-Meteo also receives normal connection information, including the originating IP address. See [Open-Meteo's privacy information](https://open-meteo.com/en/terms).

Preferences, the last temperature and its observation time are stored on the phone and watch. City text and coordinates stay on the phone; the watch receives a numeric location identifier to avoid displaying weather from a previous location. Changing location clears the displayed reading. Cached readings older than two hours show `--°`. Disabling weather retains preferences and cached data but stops requests.

The settings form is embedded in the app and works offline. Place search and weather need internet. There is no analytics or account service added by this adaptation.
