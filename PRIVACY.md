# Loading Cat Digital privacy

Weather is optional. Turn **Show temperature** off in settings to stop this watchface from requesting location or weather. Saving that change cancels an active weather HTTP request and ignores late callbacks from a location request already in progress.

When weather is enabled, the Pebble companion app obtains the phone's location. The watchface rounds latitude and longitude to two decimal places, approximately kilometre precision, then sends them over HTTPS to Open-Meteo to retrieve outdoor temperature. As the network service, Open-Meteo also receives the connection information normally associated with an HTTP request, including the originating IP address. See [Open-Meteo's privacy information](https://open-meteo.com/en/terms).

This watchface does not log or persist coordinates. It stores preferences, the last temperature and the observation time on the phone and watch. Cached readings expire from the display after two hours; they show as `--°` when stale. Disabling weather does not erase the last cached reading.

The settings form is embedded in the app and works offline. It does not request location; weather requests are handled by the companion script when weather is enabled. There is no analytics or account service added by this adaptation.
