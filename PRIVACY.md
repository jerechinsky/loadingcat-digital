# Loading Cat Digital privacy

Weather is optional. Turning **Show temperature** off stops location, city lookup and weather requests. It cancels an active HTTP request and ignores late callbacks from a location request already in progress.

**Phone location** is the default. The Pebble companion app obtains the phone's location and rounds latitude and longitude to two decimal places, approximately kilometre precision. These phone coordinates are not logged or stored.

**Custom city** uses the city and country you enter, such as `Prague, CZ`. It does not request the phone's location. The city text is sent to Open-Meteo's city lookup service, which uses GeoNames data. The chosen city and its rounded coordinates are stored on the phone; coordinates are reused for up to 30 days before another lookup. Invalid or unmatched cities show `--°` rather than using your phone's location.

Both modes send the rounded coordinates over HTTPS to Open-Meteo for outdoor temperature. Open-Meteo also receives normal connection information, including the originating IP address. See [Open-Meteo's privacy information](https://open-meteo.com/en/terms).

Preferences, the last temperature and its observation time are stored on the phone and watch. City text and coordinates stay on the phone; the watch receives a numeric location identifier to avoid displaying weather from a previous location. Changing location clears the displayed reading. Cached readings older than two hours show `--°`. Disabling weather retains preferences and cached data but stops requests.

The settings form is embedded in the app and works offline. Weather needs internet. There is no analytics or account service added by this adaptation.
