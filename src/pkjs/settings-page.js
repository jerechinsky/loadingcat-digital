/* Stock Clay form with a debounced, phone-only place suggestion list. */
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
    function sectionVisible(id, show) {
      var heading = clay.getItemById(id);
      if (heading) heading.$element[0].parentNode.style.display = show ? '' : 'none';
    }
    var location=clay.meta.userData.createLocation();
    var status=clay.getItemById('place-status'),field=items.WEATHER_CITY.$manipulatorTarget[0];
    var list=document.createElement('div');list.className='place-suggestions';list.setAttribute('role','group');list.setAttribute('aria-label','Place suggestions');
    status.$element[0].parentNode.insertBefore(list,status.$element[0]);
    status.$element[0].setAttribute('role','status');status.$element[0].setAttribute('aria-live','polite');
    var style=document.createElement('style');style.textContent='.place-suggestions{padding:0 12px}.place-suggestions button.place-result{display:block;width:100%;min-height:48px;margin:0;padding:12px;text-align:left;text-transform:none;background:transparent;color:inherit;border:0;border-bottom:1px solid #666;white-space:normal;line-height:1.4;font-size:16px}.place-result strong,.place-result small{display:block}.place-result small{font-size:13px;opacity:.75}.place-result:focus{outline:2px solid #ff5500;outline-offset:-2px}';document.head.appendChild(style);
    var xhr=null,generation=0,timer=null,composing=false,retryAt=0,cache={},cacheOrder=[];
    function cityMode(){return enabled('SHOW_WEATHER') && enabled('WEATHER_SOURCE');}
    function message(text){status.$element[0].textContent=text;visible(status,cityMode() && !!text);}
    function label(r){return [r.name,r.admin2,r.admin1,r.country || r.country_code].filter(function(x,i,a){return x && a.indexOf(x)===i;}).join(', ');}
    function selection(){return location.selection({WEATHER_CITY:items.WEATHER_CITY.get(),WEATHER_PLACE:items.WEATHER_PLACE.get()});}
    function stop(){generation++;if(timer!==null)clearTimeout(timer);timer=null;var pending=xhr;xhr=null;if(pending)pending.abort();}
    function clear(){while(list.firstChild)list.removeChild(list.firstChild);list.hidden=true;}
    function showSelected(){var chosen=selection();message(chosen?'Selected: '+label(chosen):'');}
    function render(choices){
      clear();
      choices.forEach(function(r){
        var button=document.createElement('button'),name=document.createElement('strong'),detail=document.createElement('small');
        button.type='button';button.className='place-result';name.textContent=r.name;
        detail.textContent=[r.admin2,r.admin1,r.country || r.country_code].filter(function(x,i,a){return x && x!==r.name && a.indexOf(x)===i;}).join(', ');
        button.appendChild(name);button.appendChild(detail);
        button.addEventListener('click',function(){stop();items.WEATHER_PLACE.set(location.encodeSelection(r,items.WEATHER_CITY.get()));clear();message('Selected: '+label(r));field.blur();});
        list.appendChild(button);
      });
      list.hidden=!cityMode() || !choices.length;
      message(choices.length?'Tap a result.':'No places found. Try the neighborhood and city, or another spelling.');
    }
    function search(){
      timer=null;if(!cityMode() || composing)return;
      var input=location.normalize(items.WEATHER_CITY.get()),url=location.suggestionUrl(input);
      if(!url){message('Type at least two characters.');return;}
      var key='q:'+input;if(cache[key]){render(cache[key]);return;}
      var token=generation,request=new XMLHttpRequest();xhr=request;message('Searching…');
      function current(){return token===generation && cityMode() && input===location.normalize(items.WEATHER_CITY.get());}
      request.open('GET',url,true);request.timeout=10000;
      request.onload=function(){
        if(!current())return;xhr=null;
        if(request.status!==200){if(request.status===429)retryAt=Date.now()+10000;message('Place search is unavailable. Try again shortly.');return;}
        try{var body=JSON.parse(request.responseText);if(!body || !Array.isArray(body.features))throw Error('Invalid response');var choices=location.suggestions(body,input);
          cache[key]=choices;cacheOrder.push(key);if(cacheOrder.length>20)delete cache[cacheOrder.shift()];render(choices);
        }catch(e){message('Could not read the search results. Try again.');}
      };
      request.onerror=request.ontimeout=function(){if(current()){xhr=null;message('Could not reach place search. Check your connection and try again.');}};
      request.onabort=function(){};request.send();
    }
    function schedule(immediate){
      stop();clear();if(!selection())items.WEATHER_PLACE.set('');
      if(!cityMode() || composing)return;
      var input=location.normalize(items.WEATHER_CITY.get());
      if(selection()){showSelected();return;}
      if(input.length<2){message(input?'Type at least two characters.':'');return;}
      message('Waiting for typing to finish…');
      timer=setTimeout(search,Math.max(immediate?0:900,retryAt-Date.now()));
    }
    field.addEventListener('input',function(){schedule(false);});
    field.addEventListener('compositionstart',function(){composing=true;stop();clear();items.WEATHER_PLACE.set('');});
    field.addEventListener('compositionend',function(){composing=false;schedule(false);});
    field.addEventListener('keydown',function(e){if(e.key==='Enter' || e.keyCode===13){e.preventDefault();if(!composing)schedule(true);}if(e.key==='Escape'){stop();clear();showSelected();}});
    items.WEATHER_PLACE.hide();clear();showSelected();
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
      sectionVisible('seconds-section', spinner);
      sectionVisible('animation-section', spinner);
      var seconds = spinner && enabled('SECOND_HAND');
      visible(items.NIGHT_SECONDS_PAUSE, seconds);
      visible(clay.getItemById('seconds-night-note'), seconds && enabled('NIGHT_SECONDS_PAUSE'));
      var night = (interaction && enabled('NIGHT_PAUSE')) || (seconds && enabled('NIGHT_SECONDS_PAUSE'));
      sectionVisible('night-section', night);
      visible(items.LIGHT_TRIGGER, interaction && backlight);
      visible(clay.getItemById('backlight-note'), interaction && backlight);
      visible(clay.getItemById('seconds-note'), spinner && enabled('SECOND_HAND'));
      visible(items.GRAY_NOSE, monochrome);
      ['FAHRENHEIT', 'WEATHER_INTERVAL', 'WEATHER_SOURCE'].forEach(function (key) { visible(items[key], enabled('SHOW_WEATHER')); });
      visible(items.WEATHER_CITY,cityMode());
      visible(status,cityMode() && !!status.$element[0].textContent);
      if(!cityMode()){stop();clear();}
    }
    items.GRAY_NOSE[monochrome ? 'enable' : 'disable']();
    items.LIGHT_TRIGGER[backlight ? 'enable' : 'disable']();
    ['SHOW_SPINNER', 'SECOND_HAND', 'ANIMATE', 'SHOW_WEATHER', 'WEATHER_SOURCE', 'NIGHT_PAUSE', 'NIGHT_SECONDS_PAUSE', 'DISCONNECT_VIBE', 'RECONNECT_VIBE', 'DISCONNECT_INVERT'].forEach(function (key) { items[key].on('change', update); });
    update();
  });
};
