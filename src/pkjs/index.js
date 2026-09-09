var preferences = require('./settings');
var location = require('./location');
var Clay = require('./vendor/clay');
var clay = new Clay(require('./config.json'), require('./settings-page'), {autoHandleEvents: false});
/* Open-Meteo weather. Phone coordinates are rounded and never persisted.
 * A custom city caches its resolved coordinates to avoid repeat searches. */
var CACHE_KEY = 'loading-cat-weather-v1';
var CITY_CACHE_KEY = 'loading-cat-city-v1';
var MAX_AGE_MS = 2 * 60 * 60 * 1000;
var inFlight = false;
var lastAttempt = 0;
var requestGeneration = 0;
var activeXhr = null;
var weatherWatchdog = null;
var lastDelivered = null;
var weatherSending = null;

function cancelWeather() {
  requestGeneration++;
  if (weatherWatchdog !== null) clearTimeout(weatherWatchdog);
  weatherWatchdog = null;
  var xhr = activeXhr;
  activeXhr = null;
  inFlight = false;
  if (xhr && typeof xhr.abort === 'function') xhr.abort();
}

function readCache() {
  try {
    var value = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (value && (value.scope || 'phone') === location.scope(preferences.values) && typeof value.temperature === 'number' && isFinite(value.temperature) &&
        value.temperature >= -1000 && value.temperature <= 700 &&
        typeof value.time === 'number' && isFinite(value.time) && value.time > 0 &&
        value.time * 1000 <= Date.now() && Date.now() - value.time * 1000 <= MAX_AGE_MS) return value;
  } catch (e) { /* Storage can be unavailable or corrupt. */ }
  return null;
}

function sendWeather(value) {
  var scope=value.scope || 'phone';
  var key=scope+":"+value.temperature+":"+value.time;
  if(key===lastDelivered || key===weatherSending)return;
  weatherSending=key;
  Pebble.sendAppMessage({TEMPERATURE: value.temperature, WEATHER_TIME: value.time, WEATHER_RESPONSE_LOCATION:location.id(scope)},
    function () { lastDelivered=key; if(weatherSending===key)weatherSending=null; },
    function () { if(weatherSending===key)weatherSending=null; });
}

function refreshWeather() {
  if (!preferences.values.SHOW_WEATHER) return;
  var scope=location.scope(preferences.values);
  var city=preferences.values.WEATHER_SOURCE ? location.parse(preferences.values.WEATHER_CITY) : null;
  if(preferences.values.WEATHER_SOURCE && !city)return;
  var cached = readCache();
  if (cached) sendWeather(cached);
  if (cached && Date.now() - cached.time * 1000 < preferences.values.WEATHER_INTERVAL * 60 * 1000) return;
  if (inFlight || (lastAttempt && Date.now() - lastAttempt < 5 * 60 * 1000)) return;
  inFlight = true;
  var generation = ++requestGeneration;
  lastAttempt = Date.now();
  // Cover a phone geolocation implementation that never calls either callback.
  weatherWatchdog = setTimeout(function () { if (generation === requestGeneration) cancelWeather(); }, 45000);
  function current() { return generation === requestGeneration && inFlight && preferences.values.SHOW_WEATHER; }
  function done() {
    if (generation !== requestGeneration) return;
    if (weatherWatchdog !== null) clearTimeout(weatherWatchdog);
    weatherWatchdog = null; activeXhr = null; inFlight = false;
  }
  function forecast(lat,lon) {
    if (!current()) return;
    if (typeof lat !== 'number' || typeof lon !== 'number' || !isFinite(lat) || !isFinite(lon) ||
        Math.abs(lat) > 90 || Math.abs(lon) > 180) { done(); return; }
    var xhr = new XMLHttpRequest();
    activeXhr = xhr;
    xhr.open('GET', 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(2) +
      '&longitude=' + lon.toFixed(2) + '&current=temperature_2m&temperature_unit=celsius&timeformat=unixtime', true);
    xhr.timeout = 15000;
    xhr.onload = function () {
      if (!current()) return;
      try {
        if (xhr.status !== 200) { done(); return; }
        var body = JSON.parse(xhr.responseText);
        var degrees = body.current && body.current.temperature_2m;
        if (typeof degrees !== 'number' || !isFinite(degrees) || degrees < -100 || degrees > 70) {
          done(); return;
        }
        var observed = body.current.time;
        if (typeof observed !== 'number' || !isFinite(observed) || observed <= 0 ||
            observed * 1000 > Date.now() || Date.now() - observed * 1000 > MAX_AGE_MS) { done(); return; }
        var value = {temperature: Math.round(degrees * 10), time: observed, scope:scope};
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch (e) { /* Send anyway. */ }
        sendWeather(value);
      } catch (e) { /* Malformed responses leave the last real reading alone. */ }
      done();
    };
    xhr.onerror = done;
    xhr.ontimeout = done;
    xhr.onabort = done;
    xhr.send();
  }
  if(city) {
    try {
      var saved=JSON.parse(localStorage.getItem(CITY_CACHE_KEY) || 'null');
      if(saved && saved.scope===scope && typeof saved.lat==='number' && typeof saved.lon==='number' &&
          isFinite(saved.lat) && isFinite(saved.lon) && Math.abs(saved.lat)<=90 && Math.abs(saved.lon)<=180 &&
          typeof saved.time==='number' && isFinite(saved.time) && saved.time>0 &&
          saved.time<=Date.now() && Date.now()-saved.time<30*24*60*60*1000) {
        forecast(saved.lat,saved.lon);return;
      }
    } catch(e) { /* Resolve again if the saved city is unavailable. */ }
    var search=new XMLHttpRequest();activeXhr=search;
    search.open('GET','https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(city.city)+
      '&countryCode='+city.country+'&count=5&language=en&format=json',true);
    search.timeout=15000;
    search.onload=function () {
      if(!current())return;
      try {
        if(search.status!==200){done();return;}
        var results=JSON.parse(search.responseText).results || [];
        var found=results.filter(function (r) {
          return r.country_code===city.country && /^PPL/.test(r.feature_code || '') &&
            typeof r.latitude==='number' && typeof r.longitude==='number' &&
            isFinite(r.latitude) && isFinite(r.longitude) && Math.abs(r.latitude)<=90 && Math.abs(r.longitude)<=180;
        })[0];
        if(!found){done();return;}
        var lat=Number(found.latitude.toFixed(2)),lon=Number(found.longitude.toFixed(2));
        try {localStorage.setItem(CITY_CACHE_KEY,JSON.stringify({scope:scope,lat:lat,lon:lon,time:Date.now()}));}catch(e){}
        forecast(lat,lon);
      }catch(e){done();}
    };
    search.onerror=done;search.ontimeout=done;search.onabort=done;search.send();
  } else {
    navigator.geolocation.getCurrentPosition(function (position) {
      forecast(position.coords.latitude,position.coords.longitude);
    }, done, {enableHighAccuracy: false, timeout: 15000, maximumAge: 30 * 60 * 1000});
  }
}

Pebble.addEventListener('ready', function () {
  // The watch owns the refresh schedule. It requests weather after this handshake.
  var payload = preferences.watchValues();
  payload.JS_READY = 1;
  Pebble.sendAppMessage(payload, function () {}, function () {});
});
Pebble.addEventListener('appmessage', function (event) {
  if (event.payload.REQUEST_WEATHER) refreshWeather();
});

Pebble.addEventListener('showConfiguration', function () {
  clay.setSettings(preferences.values);
  Pebble.openURL(clay.generateUrl());
});
Pebble.addEventListener('webviewclosed', function (event) {
  if (!event || !event.response || event.response === 'CANCELLED') return;
  try {
    var parsed = clay.getSettings(event.response, false);
    var previous=location.scope(preferences.values);
    preferences.save(parsed);
    if(previous!==location.scope(preferences.values)) {
      cancelWeather();lastAttempt=0;lastDelivered=null;weatherSending=null;
    }
    var payload=preferences.watchValues();
    if (!payload.SHOW_WEATHER) cancelWeather();
    Pebble.sendAppMessage(payload, function () {},
      function () { /* Saved phone settings are retried on next ready event. */ });
  } catch (e) { /* Closing without a valid save leaves settings unchanged. */ }
});
