/* Keep phone settings as numbers, including Clay select values (which are strings). */
var config = require('./config.json');
var specs = {};
config.forEach(function (section) {
  (section.items || []).forEach(function (item) {
    if (item.messageKey) specs[item.messageKey] = item;
  });
});
var values = {};
Object.keys(specs).forEach(function (key) { values[key] = Number(specs[key].defaultValue); });
function apply(input) {
  Object.keys(specs).forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) return;
    var raw = input[key];
    if (raw && typeof raw === 'object') raw = raw.value;
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
