/* Standard Clay controls, with an explicit phone-only place lookup. */
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
    var location=clay.meta.userData.createLocation();
    var find=clay.getItemById('find-place'),results=clay.getItemById('place-results'),status=clay.getItemById('place-status');
    var choices=[],xhr=null,generation=0,timeout=null;
    function cityMode(){return enabled('SHOW_WEATHER') && enabled('WEATHER_SOURCE');}
    function message(text){status.$element[0].textContent=text;}
    function label(r){return [r.name,r.admin2,r.admin1,r.country || r.country_code].filter(function(x,i,a){return x && a.indexOf(x)===i;}).join(', ');}
    function selection(){return location.selection({WEATHER_CITY:items.WEATHER_CITY.get(),WEATHER_PLACE:items.WEATHER_PLACE.get()});}
    function stop(){generation++;if(timeout!==null)clearTimeout(timeout);timeout=null;var pending=xhr;xhr=null;if(pending)pending.abort();find.enable();find.set('Find place');}
    function resetChoices(){choices=[];var select=results.$manipulatorTarget[0];while(select.firstChild)select.removeChild(select.firstChild);var option=document.createElement('option');option.value='';option.textContent='Choose a match';select.appendChild(option);results.hide();}
    function showSelected(){var chosen=selection();message(chosen?'Selected: '+label(chosen):'Find place needs internet. If a name is missing, try its full name or English spelling.');}
    function changed(){stop();resetChoices();if(!selection())items.WEATHER_PLACE.set('');showSelected();}
    function render(){
      var select=results.$manipulatorTarget[0];
      choices.forEach(function(r,i){var option=document.createElement('option');option.value=String(i);option.textContent=label(r);select.appendChild(option);});
      visible(results,cityMode() && choices.length>0);
    }
    results.on('change',function(){
      var value=results.get(),chosen=value!==''?choices[Number(value)]:null;
      if(!chosen){items.WEATHER_PLACE.set('');showSelected();return;}
      items.WEATHER_PLACE.set(location.encodeSelection(chosen,items.WEATHER_CITY.get()));
      message('Selected: '+label(chosen)+'. Tap Save settings to use it.');
    });
    items.WEATHER_CITY.on('input change',changed);
    find.on('click',function(){
      if(!cityMode())return;
      stop();resetChoices();var input=location.normalize(items.WEATHER_CITY.get()),place=location.parse(input);
      if(!place){message('Enter city, country code. For example: Prague, CZ.');return;}
      var token=generation,queries=location.searches(place,navigator.language),index=0;
      find.disable();find.set('Searching…');message('Looking for places…');
      function current(){return token===generation && cityMode() && input===location.normalize(items.WEATHER_CITY.get());}
      function finish(error){if(!current())return;stop();render();message(error || (choices.length?'Choose the matching city, region and country from the list.':'No places found. Try the full name or English spelling.'));}
      timeout=setTimeout(function(){finish('Lookup timed out. Check your connection and try again.');},30000);
      function next(){
        if(!current())return;
        var query=queries[index++];xhr=new XMLHttpRequest();var request=xhr;
        request.open('GET','https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(query.name)+'&countryCode='+place.country+'&count=20&language='+query.language+'&format=json',true);
        request.timeout=8000;
        request.onload=function(){
          if(!current())return;xhr=null;
          if(request.status!==200){finish('Place lookup is unavailable. Try again later.');return;}
          try{
            var found=location.candidates(JSON.parse(request.responseText).results,place);
            found.forEach(function(r){if(!choices.some(function(c){return c.id===r.id;}))choices.push(r);});
            if(location.matches(found,place,query).length || index>=queries.length){finish();return;}
            next();
          }catch(e){finish('Place lookup returned an unreadable response. Try again.');}
        };
        request.onerror=request.ontimeout=function(){finish('Could not reach place lookup. Check your connection and try again.');};
        request.onabort=function(){};request.send();
      }
      next();
    });
    items.WEATHER_PLACE.hide();resetChoices();showSelected();
    window.addEventListener('pagehide',stop);
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
      visible(items.WEATHER_CITY,cityMode());
      visible(find,cityMode());visible(status,cityMode());visible(results,cityMode() && choices.length>0);
      if(!cityMode())stop();
    }
    items.GRAY_NOSE[monochrome ? 'enable' : 'disable']();
    items.LIGHT_TRIGGER[backlight ? 'enable' : 'disable']();
    ['SHOW_SPINNER', 'SECOND_HAND', 'ANIMATE', 'SHOW_WEATHER', 'WEATHER_SOURCE', 'NIGHT_PAUSE', 'DISCONNECT_VIBE', 'RECONNECT_VIBE', 'DISCONNECT_INVERT'].forEach(function (key) { items[key].on('change', update); });
    update();
  });
};
