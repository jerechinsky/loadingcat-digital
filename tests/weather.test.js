const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(__dirname + '/../src/pkjs/index.js', 'utf8');
const now = 1788864000000;
function phone(options = {}) {
  const messages = [], urls = [], events = {}, timers = [];
  let geocodes=0,pendingGeoXhr;
  let requests = 0, positions = 0, saved = options.cache || null, geoSuccess, geoFailure, pendingXhr, aborted=0;
  const settingsStore = options.settings ? {'loading-cat-settings-v1':JSON.stringify(options.settings)} : {};
  if(options.cityCache)settingsStore['loading-cat-city-v1']=options.cityCache;
  const context = {
    Date: {now: () => now}, Math, JSON, isFinite,
    localStorage: {getItem: key => key === 'loading-cat-weather-v1' ? saved : settingsStore[key], setItem: (key, value) => {if (key === 'loading-cat-weather-v1') saved=value; else settingsStore[key]=value;}},
    setTimeout: fn => {timers.push(fn);return timers.length;}, clearTimeout: () => {},
    Pebble: {addEventListener: (name, fn) => events[name] = fn,
      sendAppMessage: (data, success) => {messages.push(data); if (success) success();}},
    navigator: {geolocation: {getCurrentPosition: (success, failure) => {
      positions++; geoSuccess = success; geoFailure = failure;
      if (options.defer) return;
      if (options.denied) failure();
      else success({coords: options.coords || {latitude: 50.0875, longitude: 14.4213}});
    }}},
    XMLHttpRequest: function () {
      this.open = (_, url) => {this.url=url;urls.push(url);};
      this.abort = () => {aborted++;this.onabort();};
      this.send = () => {
        if(this.url.includes('geocoding-api')) {
          geocodes++;this.status=options.geoStatus || 200;
          this.responseText=options.geoRaw===undefined ? JSON.stringify({results:options.geoResults?options.geoResults(geocodes,this.url):options.noCity?[]:[options.geoResult || {name:'Prague',feature_code:'PPLC',country_code:'CZ',latitude:50.08804,longitude:14.42076}]}) : options.geoRaw;
          pendingGeoXhr=this;if(!options.deferGeoHttp)this.onload();return;
        }
        requests++;
        if (options.timeout) {this.ontimeout(); return;}
        this.status = options.status || 200;
        this.responseText = options.raw === undefined ? JSON.stringify(options.body || {
          current: {temperature_2m: -3.6, time: now / 1000 - 900}
        }) : options.raw;
        pendingXhr=this;
        if(!options.deferHttp)this.onload();
      };
    }
  };
  vm.createContext(context);
  const settingsContext = vm.createContext({...context, exports: {}, require: name => name==='./location' ? require('../src/pkjs/location') : JSON.parse(fs.readFileSync(__dirname+'/../src/pkjs/config.json','utf8'))});
  vm.runInContext(fs.readFileSync(__dirname+'/../src/pkjs/settings.js','utf8'), settingsContext);
  context.require = name => {
    if (name === './settings') return settingsContext.exports;
    if (name === './location') return require('../src/pkjs/location');
    if (name === './config.json') return [];
    if (name === './settings-page') return function () {};
    if (name === './vendor/clay') return function () {
      this.getSettings = response => JSON.parse(decodeURIComponent(response));
      this.setSettings = () => {};
      this.generateUrl = () => 'data:text/html,test';
    };
    throw new Error(name);
  };
  vm.runInContext(code, context);
  return {context, messages, urls, events, get saved() {return saved;},
    get savedSettings() {return JSON.parse(settingsStore['loading-cat-settings-v1'] || '{}');}, get requests() {return requests;},
    get positions() {return positions;}, get geocodes(){return geocodes;}, get cityCache(){return settingsStore['loading-cat-city-v1'];}, resolveGeoHttp:()=>pendingGeoXhr.onload(), resolve: () => geoSuccess({coords: {latitude: 0, longitude: 0}}),
    reject: () => geoFailure(), timeout: () => timers[0](), resolveHttp: () => pendingXhr.onload(), get aborted(){return aborted;}};
}
function refresh(p) {p.events.appmessage({payload: {REQUEST_WEATHER: 1}});}
let p = phone(); p.events.ready(); refresh(p);
assert.equal(p.requests, 1); assert.equal(p.messages[1].TEMPERATURE, -36);
assert.equal(p.messages[1].WEATHER_TIME, now / 1000 - 900);
assert.match(p.urls[0], /latitude=50\.09&longitude=14\.42/);
assert.match(p.urls[0], /temperature_unit=celsius/);
assert(!p.saved.includes('latitude')); refresh(p); assert.equal(p.requests, 1);
for (const options of [{denied:true},{timeout:true},{status:503},{raw:'broken'},
  {body:{current:{temperature_2m:null,time:now/1000}}},
  {body:{current:{temperature_2m:22,time:now/1000-10800}}},
  {body:{current:{temperature_2m:22,time:now/1000+900}}},
  {coords:{latitude:NaN,longitude:0}}]) {
  p = phone(options); refresh(p);
  assert.equal(p.messages.length, 0, JSON.stringify(options));
  assert.equal(p.context.inFlight, false);
}
p = phone({defer:true}); refresh(p); refresh(p); assert.equal(p.positions, 1); p.resolve(); assert.equal(p.requests, 1);
p = phone({cache:JSON.stringify({temperature:220,time:now/1000-600})}); refresh(p);
assert.equal(p.requests, 0); assert.equal(p.messages[0].TEMPERATURE, 220);
p = phone({cache:JSON.stringify({temperature:220,time:now/1000-3600}),denied:true}); refresh(p);
assert.equal(p.messages[0].TEMPERATURE,220);
p = phone({cache:JSON.stringify({temperature:220,time:now/1000-10800}),denied:true}); refresh(p);
assert.equal(p.messages.length,0);
p = phone({cache:'malformed'}); refresh(p); assert.equal(p.requests,1);
console.log('Weather checks passed: location precision, Celsius, observation age, caching, offline, denied permission, malformed data and duplicate requests.');

p = phone(); p.events.webviewclosed({response:JSON.stringify({SHOW_WEATHER:{value:false}})}); refresh(p);
assert.equal(p.positions,0,'disabled weather must never request location');
p = phone({defer:true}); refresh(p); p.events.webviewclosed({response:JSON.stringify({SHOW_WEATHER:0})}); p.resolve();
assert.equal(p.requests,0,'disabling weather during geolocation must stop the HTTP request');
p = phone(); p.events.webviewclosed({response:JSON.stringify({STYLE:{value:'2'},SPIN_MOTION:{value:'1'},SPOKES:{value:'6'},WEATHER_INTERVAL:{value:'60'}})});
assert.equal(p.messages[0].STYLE,undefined); assert.equal(p.messages[0].SPIN_MOTION,1); assert.equal(p.messages[0].SPOKES,6); assert.equal(p.messages[0].WEATHER_INTERVAL,60);
p.events.webviewclosed({response:JSON.stringify({STYLE:{value:'999'},SPIN_MOTION:{value:'999'},SPOKES:{value:'5'}})});
assert.equal(p.messages.filter(m => m.SPIN_MOTION !== undefined).at(-1).SPIN_MOTION,1);
p = phone(); p.events.webviewclosed({response:'CANCELLED'}); assert.equal(p.messages.length,0);
console.log('Settings checks passed: numeric dropdowns, valid choices, cancellation and weather privacy switch.');
p = phone(); p.events.ready(); assert.equal(p.messages[0].STYLE,undefined); assert.equal(p.messages[0].SPIN_MOTION,1,'Fast spin is the default'); assert.equal(p.messages[0].SPIN_LENGTH,0,'Three seconds is the default'); assert.equal(p.messages[0].SPOKES,8);
assert.equal(p.messages[0].GRAY_NOSE,1,'The gray nose is enabled by default on monochrome models');
assert.equal(p.messages[0].SECOND_HAND,1,'The spinner shows seconds by default');
p.events.webviewclosed({response:JSON.stringify({SPOKES:{value:'7'}})});
assert.equal(p.messages.filter(m => m.SPOKES !== undefined).at(-1).SPOKES,7);
console.log('Custom spoke count and straight-stroke default verified.');

// Late callbacks after weather is hidden or its watchdog expires cannot revive a request.
p=phone({deferHttp:true});refresh(p);assert.equal(p.requests,1);
p.events.webviewclosed({response:JSON.stringify({SHOW_WEATHER:0})});
assert.equal(p.aborted,1);p.resolveHttp();assert(!p.messages.some(m=>m.TEMPERATURE!==undefined));
p=phone({defer:true});refresh(p);p.timeout();p.resolve();assert.equal(p.requests,0);
// Exercise every declared setting choice through the real normalization/save path.
const config=JSON.parse(fs.readFileSync(__dirname+'/../src/pkjs/config.json','utf8'));
const publicSettings=config.flatMap(section=>section.items||[]).filter(spec=>spec.messageKey);
assert.equal(publicSettings.length,24,'The public menu only exposes supported presentation choices');
assert.deepEqual(publicSettings.find(spec=>spec.messageKey==='SPOKES').options.map(option=>Number(option.value)),[6,7,8,10,12]);
for(const section of config)for(const spec of section.items||[])if(spec.messageKey){
 for(const value of spec.type==='input'?['','Prague, CZ','New York, US']:spec.type==='toggle'?[0,1]:spec.options.map(o=>Number(o.value))){
  p=phone();p.events.webviewclosed({response:JSON.stringify({[spec.messageKey]:{value}})});
  if(['WEATHER_SOURCE','WEATHER_CITY'].includes(spec.messageKey)){assert.equal(p.savedSettings[spec.messageKey],value);assert.equal(p.messages[0][spec.messageKey],undefined);}
  else assert.equal(p.messages.find(m=>m[spec.messageKey]!==undefined)[spec.messageKey],value,spec.messageKey);
 }
}
console.log('All setting choices and late weather cancellation callbacks passed.');

// Retired visual options cannot hide the clock or restore low-contrast layouts.
const retiredSettings={STYLE:2,SHOW_TIME:0,TIME_LAYOUT:1,FONT_STYLE:1,COMPACT:1,DARK_TEXT:0,OUTLINE:0};
const preservedSettings={SPIN_LENGTH:2,SPIN_MOTION:0,NUMERAL_FONT:7,SHOW_WEATHER:0,TIME_FORMAT:2,LEADING_ZERO:0,FAHRENHEIT:1,WEATHER_INTERVAL:60,GRAY_NOSE:0,SECOND_HAND:0};
for(const spokes of [0,11]){
 p=phone({settings:{...retiredSettings,...preservedSettings,SPOKES:spokes}});p.events.ready();
 assert.equal(p.messages[0].SPOKES,8,'Retired spoke counts migrate to eight');
 for(const key of Object.keys(retiredSettings))assert.equal(p.messages[0][key],undefined,key+' must not reach the watch');
 for(const [key,value] of Object.entries(preservedSettings))assert.equal(p.messages[0][key],value,key+' must survive migration');
 assert.equal(p.positions,0,'Hidden weather remains hidden after migration');
 // Saving a new page permanently strips old keys and retains all valid choices.
 p.events.webviewclosed({response:JSON.stringify({...retiredSettings,SPOKES:{value:'11'}})});
 assert.equal(p.savedSettings.SPOKES,8);
 for(const key of Object.keys(retiredSettings))assert.equal(p.savedSettings[key],undefined,key+' must not remain in saved settings');
 for(const [key,value] of Object.entries(preservedSettings))assert.equal(p.savedSettings[key],value,key+' must survive saving');
 assert.equal(Object.keys(p.savedSettings).length,24);
}
// Existing installs receive the new monochrome treatment until explicitly disabled.
p=phone({settings:{NUMERAL_FONT:2,SHOW_WEATHER:0}});p.events.ready();assert.equal(p.messages[0].GRAY_NOSE,1);
p.events.webviewclosed({response:JSON.stringify({GRAY_NOSE:{value:false}})});assert.equal(p.savedSettings.GRAY_NOSE,0);
p.events.webviewclosed({response:JSON.stringify({GRAY_NOSE:{value:'2'}})});assert.equal(p.savedSettings.GRAY_NOSE,0,'Invalid gray-nose values must not re-enable the setting');
// Seconds are available to existing installs and can be disabled independently.
p=phone({settings:{SHOW_WEATHER:0,GRAY_NOSE:0,ANIMATE:0}});p.events.ready();assert.equal(p.messages[0].SECOND_HAND,1);
p.events.webviewclosed({response:JSON.stringify({SECOND_HAND:{value:false}})});assert.equal(p.savedSettings.SECOND_HAND,0);
p.events.webviewclosed({response:JSON.stringify({SECOND_HAND:{value:'2'}})});assert.equal(p.savedSettings.SECOND_HAND,0,'Invalid seconds values must not re-enable the setting');
assert.equal(p.savedSettings.GRAY_NOSE,0);assert.equal(p.savedSettings.ANIMATE,0);assert.equal(p.savedSettings.SHOW_WEATHER,0);
// A rejected count must not overwrite a currently supported selection either.
p=phone({settings:{SPOKES:7}});p.events.webviewclosed({response:JSON.stringify({SPOKES:11})});assert.equal(p.savedSettings.SPOKES,7);
const keys=JSON.parse(fs.readFileSync(__dirname+'/../package.json','utf8')).pebble.messageKeys;
for(const [key,index] of Object.entries({STYLE:4,SHOW_TIME:11,TIME_FORMAT:12,LEADING_ZERO:13,FONT_STYLE:14,COMPACT:15,DARK_TEXT:16,OUTLINE:17,SHOW_WEATHER:18,FAHRENHEIT:19,WEATHER_INTERVAL:20,TIME_LAYOUT:21,NUMERAL_FONT:22,SPIN_MOTION:23,GRAY_NOSE:24,SECOND_HAND:25}))assert.equal(keys.indexOf(key),index,key+' must retain its AppMessage identity');
console.log('Retired settings migrate, preferences persist, and message-key identities are stable.');

// Twelve spokes is supported, including saved preferences from older versions.
p=phone({settings:{SPOKES:12}});p.events.ready();assert.equal(p.messages[0].SPOKES,12);
p.events.webviewclosed({response:JSON.stringify({SPOKES:12})});assert.equal(p.savedSettings.SPOKES,12);

p=phone();p.events.ready();assert.equal(p.messages[0].NIGHT_PAUSE,0);assert.equal(p.messages[0].NIGHT_START,22);assert.equal(p.messages[0].NIGHT_END,7);
p.events.webviewclosed({response:JSON.stringify({NIGHT_PAUSE:1,NIGHT_START:23,NIGHT_END:8})});assert.equal(p.savedSettings.NIGHT_PAUSE,1);assert.equal(p.savedSettings.NIGHT_START,23);assert.equal(p.savedSettings.NIGHT_END,8);
for(const [key,index] of Object.entries({NIGHT_PAUSE:26,NIGHT_START:27,NIGHT_END:28}))assert.equal(keys.indexOf(key),index);

assert.equal(keys.indexOf('DISCONNECT_VIBE'),29);
p=phone();p.events.ready();assert.equal(p.messages[0].DISCONNECT_VIBE,0);
p.events.webviewclosed({response:JSON.stringify({DISCONNECT_VIBE:1})});assert.equal(p.savedSettings.DISCONNECT_VIBE,1);assert.equal(p.messages.filter(m=>m.DISCONNECT_VIBE!==undefined).at(-1).DISCONNECT_VIBE,1);
p.events.webviewclosed({response:JSON.stringify({DISCONNECT_VIBE:0})});assert.equal(p.savedSettings.DISCONNECT_VIBE,0);
console.log('Disconnect vibration default, save, delivery and stable message key passed.');

assert.equal(keys.indexOf('DISCONNECT_PATTERN'),30);assert.equal(keys.indexOf('DISCONNECT_IGNORE_QUIET'),31);
p=phone();p.events.ready();assert.equal(p.messages[0].DISCONNECT_PATTERN,2);assert.equal(p.messages[0].DISCONNECT_IGNORE_QUIET,0);
p.events.webviewclosed({response:JSON.stringify({DISCONNECT_VIBE:1,DISCONNECT_PATTERN:3,DISCONNECT_IGNORE_QUIET:1})});assert.equal(p.savedSettings.DISCONNECT_PATTERN,3);assert.equal(p.savedSettings.DISCONNECT_IGNORE_QUIET,1);

assert.equal(keys.indexOf('DISCONNECT_DELAY'),32);assert.equal(keys.indexOf('DISCONNECT_INVERT'),33);
p=phone();p.events.ready();assert.equal(p.messages[0].DISCONNECT_DELAY,undefined);assert.equal(p.messages[0].DISCONNECT_INVERT,0);
p.events.webviewclosed({response:JSON.stringify({DISCONNECT_DELAY:15,DISCONNECT_INVERT:1})});assert.equal(p.savedSettings.DISCONNECT_DELAY,undefined);assert.equal(p.savedSettings.DISCONNECT_INVERT,1);

// Only the watch initiates weather; saving unrelated settings never starts GPS.
p=phone();p.events.ready();assert.equal(p.positions,0);refresh(p);assert.equal(p.positions,1);
let delivered=p.messages.filter(m=>m.TEMPERATURE!==undefined).length;
refresh(p);refresh(p);assert.equal(p.messages.filter(m=>m.TEMPERATURE!==undefined).length,delivered);
p=phone({denied:true});refresh(p);assert.equal(p.positions,1);
p.events.webviewclosed({response:JSON.stringify({NUMERAL_FONT:7})});refresh(p);assert.equal(p.positions,1,'Saving the font must not reset weather retry throttling');
p=phone({settings:{DISCONNECT_DELAY:60}});p.events.ready();assert.equal(p.messages[0].DISCONNECT_DELAY,undefined);
p.events.webviewclosed({response:JSON.stringify({DISCONNECT_INVERT:1})});assert.equal(p.savedSettings.DISCONNECT_DELAY,undefined);
console.log('Battery checks passed: single weather scheduler, cached reply deduplication, unrelated settings preserve backoff, retired delay ignored.');

// Custom cities never ask for the phone location; country filtering is explicit.
const location=require('../src/pkjs/location');
p=phone({settings:{WEATHER_SOURCE:1,WEATHER_CITY:'  Prague , cz '}});p.events.ready();refresh(p);
assert.equal(p.positions,0);assert.equal(p.geocodes,1);assert.equal(p.requests,1);
assert.match(p.urls[0],/name=Prague&countryCode=CZ/);assert.match(p.urls[1],/latitude=50.09&longitude=14.42/);
assert.equal(p.messages[0].WEATHER_CITY,undefined);assert.equal(p.messages[0].WEATHER_SOURCE,undefined);
assert.equal(p.messages[0].WEATHER_LOCATION_ID,location.id('city:prague, cz'));
assert.equal(p.messages.at(-1).WEATHER_RESPONSE_LOCATION,p.messages[0].WEATHER_LOCATION_ID);
const savedCity=p.cityCache;
p=phone({settings:{WEATHER_SOURCE:1,WEATHER_CITY:'Prague, CZ'},cityCache:savedCity});refresh(p);
assert.equal(p.geocodes,0);assert.equal(p.positions,0);assert.equal(p.requests,1);
for(const extra of [{noCity:true},{geoStatus:503},{geoRaw:'bad'},
 {geoResult:{country_code:'US',feature_code:'PPLC',latitude:50,longitude:14}},
 {geoResult:{country_code:'CZ',feature_code:'PPLC',latitude:200,longitude:14}}]){
 p=phone({...extra,settings:{WEATHER_SOURCE:1,WEATHER_CITY:'Prague, CZ'},cache:JSON.stringify({temperature:220,time:now/1000-60})});refresh(p);
 assert.equal(p.positions,0);assert.equal(p.requests,0);assert.equal(p.messages.length,0,'No old phone-city weather or fallback GPS after a failed city lookup');
}
for(const city of ['', 'Prague', 'Prague, Czechia', 'Prague, ZZQ']){
 p=phone({settings:{WEATHER_SOURCE:1,WEATHER_CITY:city}});refresh(p);assert.equal(p.positions,0);assert.equal(p.geocodes,0);assert.equal(p.messages.length,0);
}
p=phone({settings:{WEATHER_SOURCE:1,WEATHER_CITY:'Prague, CZ',SHOW_WEATHER:0}});refresh(p);assert.equal(p.positions+p.geocodes,0);
p=phone({settings:{WEATHER_SOURCE:1,WEATHER_CITY:'Prague, CZ'},deferGeoHttp:true});refresh(p);
p.events.webviewclosed({response:JSON.stringify({WEATHER_SOURCE:0})});p.resolveGeoHttp();assert.equal(p.requests,0);assert.equal(p.aborted,1);refresh(p);assert.equal(p.positions,1);
p=phone({defer:true});refresh(p);p.events.webviewclosed({response:JSON.stringify({WEATHER_SOURCE:1,WEATHER_CITY:'Prague, CZ'})});p.resolve();assert.equal(p.requests,0);refresh(p);assert.equal(p.geocodes,1);
p=phone({settings:{WEATHER_SOURCE:1,WEATHER_CITY:'Prague, CZ'},deferHttp:true});refresh(p);p.events.webviewclosed({response:JSON.stringify({WEATHER_CITY:'London, GB'})});p.resolveHttp();assert(!p.messages.some(m=>m.TEMPERATURE!==undefined));
assert.equal(location.normalize('  Praha,  cz  '),'Praha, CZ');assert.deepEqual(location.parse('Český Krumlov, cz'),{city:'Český Krumlov',country:'CZ'});
console.log('Custom location passed: parsing, country filtering, city cache, no GPS, stale-cache isolation, source switches and late callback cancellation.');

// Localized queries preserve the input script and normalize common country aliases.
for(const [city,country,language] of [['san francisco, us','US','en'],['nyc, usa','US','en'],['Praha, CZE','CZ','en'],['Київ, UA','UA','uk'],['Львів, UKR','UA','uk'],['北京，CN','CN','zh'],['上海, CHN','CN','zh'],['東京都, JP','JP','ja'],['大阪市, JPN','JP','ja']]) {
 p=phone({settings:{WEATHER_SOURCE:1,WEATHER_CITY:city},geoResult:{country_code:country,feature_code:'PPL',latitude:35,longitude:140}});refresh(p);
 assert.equal(p.positions,0);assert.equal(p.requests,1);assert.equal(p.geocodes,1);
 assert.equal(new URL(p.urls[0]).searchParams.get('language'),language);
 assert.equal(new URL(p.urls[0]).searchParams.get('countryCode'),country);
 assert.equal(new URL(p.urls[0]).searchParams.get('name'),location.parse(city).city);
}
assert.equal(location.normalize('nyc, usa'),'nyc, US');assert.equal(location.normalize('London, UK'),'London, GB');
assert.equal(location.normalize('東京，ＪＰ'),'東京, JP');
assert.equal(location.scope({WEATHER_SOURCE:1,WEATHER_CITY:'nyc, usa'}),location.scope({WEATHER_SOURCE:1,WEATHER_CITY:'nyc, US'}));
for(const [short,full] of [['東京','東京都'],['大阪','大阪市'],['京都','京都市']]) {
 p=phone({settings:{WEATHER_SOURCE:1,WEATHER_CITY:short+', JP'},geoResults:n=>n===1?[]:[{country_code:'JP',feature_code:'PPLC',latitude:35,longitude:139}]});refresh(p);
 assert.equal(p.positions,0);assert.equal(p.requests,1);assert.equal(p.geocodes,2);
 assert.equal(new URL(p.urls[1]).searchParams.get('name'),full);
}
p=phone({settings:{WEATHER_SOURCE:1,WEATHER_CITY:'東京, JP'},noCity:true});refresh(p);assert.equal(p.geocodes,2);assert.equal(p.requests,0);assert.equal(p.context.inFlight,false);refresh(p);assert.equal(p.geocodes,2,'Fallback is bounded and retry throttling still applies');
p=phone({settings:{WEATHER_SOURCE:1,WEATHER_CITY:'東京, JP'},geoStatus:503});refresh(p);assert.equal(p.geocodes,1,'Do not retry alternate spellings after server errors');
p=phone({settings:{WEATHER_SOURCE:1,WEATHER_CITY:'東京, JP'},deferGeoHttp:true,noCity:true});refresh(p);p.events.webviewclosed({response:JSON.stringify({SHOW_WEATHER:0})});p.resolveGeoHttp();assert.equal(p.geocodes,1);assert.equal(p.positions,0,'Disabling weather cancels pending spelling fallbacks');
console.log('Language checks passed: country aliases, Unicode input, localized searches, bounded Japanese-name fallback, no GPS and cancellation.');
