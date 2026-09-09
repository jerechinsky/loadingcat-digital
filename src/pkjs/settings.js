/* Normalize Clay select values to numbers; keep the custom city as text. */
var location = require('./location');
var config = require('./config.json');
var specs = {};
config.forEach(function (section) {
  (section.items || []).forEach(function (item) {
    if (item.messageKey) specs[item.messageKey] = item;
  });
});
var values = {};
Object.keys(specs).forEach(function (key) { values[key] = specs[key].type==='input' ? specs[key].defaultValue : Number(specs[key].defaultValue); });
function apply(input) {
  Object.keys(specs).forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) return;
    var raw = input[key];
    if (raw && typeof raw === 'object') raw = raw.value;
    if(specs[key].type==='input') { if(typeof raw==='string')values[key]=location.normalize(raw); return; }
    if (raw === null || raw === '' || typeof raw === 'undefined') return;
    var value = Number(raw), spec = specs[key];
    if (!isFinite(value)) return;
    var allowed = spec.type === 'toggle' ? [0,1] : spec.options.map(function (o) { return Number(o.value); });
    if (allowed.indexOf(value) >= 0) values[key] = value;
  });
}
try { apply(JSON.parse(localStorage.getItem('loading-cat-settings-v1') || '{}')); } catch (e) {}
exports.values = values;
exports.save = function (input) {
  apply(input);
  try { localStorage.setItem('loading-cat-settings-v1',JSON.stringify(values)); } catch (e) {}
  return values;
};

// City text stays on the phone; the watch receives only a small cache identity.
exports.watchValues = function () {
  var payload={};
  Object.keys(values).forEach(function (key) {
    if(key!=='WEATHER_SOURCE' && key!=='WEATHER_CITY')payload[key]=values[key];
  });
  payload.WEATHER_LOCATION_ID=location.id(location.scope(values));
  return payload;
};
