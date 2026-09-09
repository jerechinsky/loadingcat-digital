/* Keep the standard Clay form; only hide controls that do not apply. */
module.exports = function () {
  var clay = this;
  clay.on(clay.EVENTS.AFTER_BUILD, function () {
    var items = {};
    clay.getAllItems().forEach(function (item) { if (item.messageKey) items[item.messageKey] = item; });
    var platform = clay.meta.activeWatchInfo && clay.meta.activeWatchInfo.platform;
    var monochrome = ['aplite', 'diorite', 'flint'].indexOf(platform) >= 0;
    var backlight = ['emery', 'flint', 'gabbro'].indexOf(platform) >= 0;
    function enabled(key) { return !!Number(items[key].get()); }
    function visible(item, show) { if (item) item[show ? 'show' : 'hide'](); }
    function update() {
      visible(items.DISCONNECT_PATTERN, enabled('DISCONNECT_VIBE'));
      visible(items.RECONNECT_PATTERN, enabled('RECONNECT_VIBE'));
      var vibration=enabled('DISCONNECT_VIBE') || enabled('RECONNECT_VIBE');
      visible(items.DISCONNECT_IGNORE_QUIET, vibration);
      var connectionAlert=vibration || enabled('DISCONNECT_INVERT');
      visible(clay.getItemById('disconnect-note'), connectionAlert);
      var spinner = enabled('SHOW_SPINNER'), interaction = spinner && enabled('ANIMATE');
      ['SPOKES', 'SECOND_HAND', 'ANIMATE'].forEach(function (key) { visible(items[key], spinner); });
      ['FLICK_TRIGGER', 'SPIN_MOTION', 'SPIN_LENGTH', 'NIGHT_PAUSE'].forEach(function (key) { visible(items[key], interaction); });
      ['NIGHT_START', 'NIGHT_END'].forEach(function (key) { visible(items[key], interaction && enabled('NIGHT_PAUSE')); });
      visible(clay.getItemById('night-note'), interaction && enabled('NIGHT_PAUSE'));
      visible(items.LIGHT_TRIGGER, interaction && backlight);
      visible(clay.getItemById('backlight-note'), interaction && backlight);
      visible(clay.getItemById('seconds-note'), spinner && enabled('SECOND_HAND'));
      visible(items.GRAY_NOSE, monochrome);
      ['FAHRENHEIT', 'WEATHER_INTERVAL', 'WEATHER_SOURCE'].forEach(function (key) { visible(items[key], enabled('SHOW_WEATHER')); });
      visible(items.WEATHER_CITY, enabled('SHOW_WEATHER') && enabled('WEATHER_SOURCE'));
    }
    items.GRAY_NOSE[monochrome ? 'enable' : 'disable']();
    items.LIGHT_TRIGGER[backlight ? 'enable' : 'disable']();
    ['SHOW_SPINNER', 'SECOND_HAND', 'ANIMATE', 'SHOW_WEATHER', 'WEATHER_SOURCE', 'NIGHT_PAUSE', 'DISCONNECT_VIBE', 'RECONNECT_VIBE', 'DISCONNECT_INVERT'].forEach(function (key) { items[key].on('change', update); });
    update();
  });
};
