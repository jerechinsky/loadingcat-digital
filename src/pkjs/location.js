/* Phone-only city input and stable weather-cache identity. */
exports.normalize = function (value) {
  if (typeof value !== 'string') return '';
  var text=value.replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
  return text.replace(/\s*,\s*([a-z]{2})$/i,function (_,country) { return ', '+country.toUpperCase(); });
};
exports.parse = function (value) {
  var match=/^([^,]{2,}),\s*([A-Z]{2})$/.exec(exports.normalize(value));
  return match ? {city:match[1].trim(),country:match[2]} : null;
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
