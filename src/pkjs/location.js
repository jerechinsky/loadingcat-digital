/* Phone-only city input and stable weather-cache identity. */
var COUNTRY_ALIASES={USA:'US',UK:'GB',GBR:'GB',CZE:'CZ',UKR:'UA',CHN:'CN',JPN:'JP'};
exports.normalize = function (value) {
  if (typeof value !== 'string') return '';
  var text=value.replace(/[\uff01-\uff5e]/g,function (c) {return String.fromCharCode(c.charCodeAt(0)-0xfee0);})
    .replace(/、/g,',').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
  return text.replace(/\s*,\s*([a-z]{2,3})$/i,function (_,country) {
    country=country.toUpperCase();return ', '+(COUNTRY_ALIASES[country] || country);
  });
};
exports.parse = function (value) {
  var match=/^([^,]{2,}),\s*([A-Z]{2})$/.exec(exports.normalize(value));
  return match ? {city:match[1].trim(),country:match[2]} : null;
};
exports.searches = function (place) {
  var name=place.city,language='en';
  // Open-Meteo indexes localized names by language, not only output labels.
  if(/[\u3040-\u30ff]/.test(name))language='ja';
  else if(/[\u3400-\u9fff]/.test(name))language=place.country==='JP'?'ja':'zh';
  else if(/[\u0400-\u04ff]/.test(name))language=/[іїєґІЇЄҐ]/.test(name)?'uk':
    ({UA:'uk',BG:'bg',BY:'be',RS:'sr',MK:'mk',KZ:'kk',MN:'mn'}[place.country] || 'ru');
  else if(/[\uac00-\ud7af]/.test(name))language='ko';
  else if(/[\u0370-\u03ff]/.test(name))language='el';
  else if(/[\u0590-\u05ff]/.test(name))language='he';
  else if(/[\u0600-\u06ff]/.test(name))language='ar';
  var queries=[{name:name,language:language}];
  // Two-character searches are exact: Japanese city entries often include 市.
  if(place.country==='JP' && /^[\u3400-\u9fff]{2}$/.test(name))
    queries.push({name:name+(name==='東京'?'都':'市'),language:'ja'});
  return queries;
};
exports.scope = function (values) {
  return values.WEATHER_SOURCE ? 'city:'+exports.normalize(values.WEATHER_CITY).toLowerCase() : 'phone';
};
exports.id = function (scope) {
  if(scope==='phone')return 0;
  var hash=5381;
  for(var i=0;i<scope.length;i++)hash=((hash*33)^scope.charCodeAt(i))|0;
  return (hash&0x7fffffff)||1;
};
