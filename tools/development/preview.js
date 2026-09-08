/* Development-only rendering study. Not imported or shipped in the settings page. */
/* Clay copies this entire function into its offline page. Keep every dependency
 * inside the function or in meta.userData; no browser network access is needed. */
module.exports = function () {
  var clay = this;
  clay.on(clay.EVENTS.AFTER_BUILD, function () {
    var assets = clay.meta.userData.preview;
    var active = clay.meta.activeWatchInfo && clay.meta.activeWatchInfo.platform;
    var names = {aplite:'Pebble / Steel',basalt:'Time / Time Steel',chalk:'Time Round',diorite:'Pebble 2',emery:'Time 2',flint:'2 Duo',gabbro:'Round 2'};
    var platform = assets.models[active] ? active : 'emery';
    var items = {}, state = {}, images = {}, timer = null, phase = 0, step = 0, running = false;
    var secondsTimer=null,secondsPlaying=true,secondsBase=0,secondsEpoch=Date.now();
    clay.getAllItems().forEach(function (item) { if (item.messageKey) {items[item.messageKey] = item;if(item.$element[0])item.$element[0].setAttribute('data-setting-row',item.messageKey);if(item.$manipulatorTarget[0])item.$manipulatorTarget[0].setAttribute('data-setting-key',item.messageKey);} });
    var style = document.createElement('style');
    style.textContent = '.cat-preview{position:sticky;top:0;z-index:30;background:#fff8df;color:#222;padding:12px 14px;box-shadow:0 2px 8px #0002;box-sizing:border-box}.cat-preview *{box-sizing:border-box}.cat-preview-grid{display:flex;align-items:center;justify-content:center;gap:16px}.cat-preview canvas{display:block;width:150px;image-rendering:pixelated;flex-shrink:0;cursor:pointer}.cat-preview-controls{min-width:0;max-width:170px;flex:1}.cat-preview label{display:block;font:13px sans-serif;margin:0 0 5px}.cat-preview select,.cat-preview input,.cat-preview button{font:14px sans-serif;width:100%;height:35px;border:1px solid #bdb79f;border-radius:6px;background:#fff;color:#222;margin:0 0 8px;padding:5px}.cat-preview button{min-width:0!important;background:#242420;color:#fff;border:0;cursor:pointer}.cat-preview button:disabled{opacity:.4;cursor:default}.cat-preview p{font:12px/1.4 sans-serif;margin:7px 0 0;text-align:center}.cat-reset{display:block;margin:12px auto;padding:10px 18px;border:1px solid #888;border-radius:5px;background:transparent;font-size:15px}';
    style.textContent += '.cat-preview-controls{max-width:none}.cat-preview-field{min-width:0}.cat-preview-wide .cat-preview-grid{flex-direction:column}.cat-preview-wide .cat-preview-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}.cat-preview-wide button{grid-column:auto}@media(max-width:360px){.cat-preview-grid{flex-direction:column}.cat-preview-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}.cat-preview button{grid-column:auto}}';
    style.textContent+='#cat-preview-seconds-field{grid-column:1 / -1}';
    document.head.appendChild(style);
    var panel = document.createElement('section');
    panel.className = 'cat-preview'; panel.setAttribute('aria-label','Live watchface preview');
    panel.innerHTML = '<div class="cat-preview-grid"><canvas id="cat-preview-canvas" role="img" aria-label="Watchface preview"></canvas><div class="cat-preview-controls"><div class="cat-preview-field"><label for="cat-preview-model">Preview on</label><select id="cat-preview-model"></select></div><div class="cat-preview-field"><label for="cat-preview-time">Example time</label><input id="cat-preview-time" type="time" value="16:49"></div><div class="cat-preview-field" id="cat-preview-seconds-field"><label for="cat-preview-seconds">Example seconds <output id="cat-preview-seconds-value">0.0</output></label><input id="cat-preview-seconds" type="range" min="0" max="59.9" step="0.1" value="0"></div><button id="cat-preview-play-seconds" type="button">Pause seconds</button><button id="cat-preview-spin" type="button">Test animation</button></div></div><p id="cat-preview-caption">Sample weather. Save settings to apply changes.</p>';
    document.body.insertBefore(panel,document.body.firstChild);
    var canvas = document.getElementById('cat-preview-canvas'), ctx = canvas.getContext('2d');
    var modelSelect = document.getElementById('cat-preview-model');
    var timeInput = document.getElementById('cat-preview-time');
    var spinButton = document.getElementById('cat-preview-spin');
    var secondsInput=document.getElementById('cat-preview-seconds'),secondsValue=document.getElementById('cat-preview-seconds-value'),secondsButton=document.getElementById('cat-preview-play-seconds');
    Object.keys(names).forEach(function (key) {
      var option = document.createElement('option'); option.value=key; option.textContent=names[key];modelSelect.appendChild(option);
      var image = new Image();image.onload=draw;image.src=assets.models[key].image;images[key]=image;
    });
    modelSelect.value=platform;
    function number(key) { return Number(items[key].get()); }
    function visible(key, show) { if(items[key]) items[key][show?'show':'hide'](); }
    function stop(reset) { if(timer!==null) clearTimeout(timer);timer=null;running=false;step=0;if(reset)phase=0; }
    function update() {
      Object.keys(items).forEach(function(key){state[key]=number(key);});
      ['SPOKES','SECOND_HAND','ANIMATE'].forEach(function(k){visible(k,state.SHOW_SPINNER);});
      ['FLICK_TRIGGER','LIGHT_TRIGGER','SPIN_MOTION','SPIN_LENGTH'].forEach(function(k){visible(k,state.SHOW_SPINNER && state.ANIMATE);});
      ['FAHRENHEIT','WEATHER_INTERVAL'].forEach(function(k){visible(k,state.SHOW_WEATHER);});
      var supportsNose=['aplite','diorite','flint'].indexOf(platform)>=0;
      visible('GRAY_NOSE',supportsNose);items.GRAY_NOSE[supportsNose?'enable':'disable']();
      var supportsLight=['emery','flint','gabbro'].indexOf(platform)>=0;
      items.LIGHT_TRIGGER[supportsLight?'enable':'disable']();
      var note=clay.getItemById('backlight-note');
      if(note){note.set(supportsLight?'Back can spin the cat when it wakes the light. Other light activations can also trigger it.':'This model supports wrist flick. Backlight-triggered animation is unavailable.');note[state.SHOW_SPINNER && state.ANIMATE?'show':'hide']();}
      var motionNote=clay.getItemById('spin-motion-note');if(motionNote)motionNote[state.SHOW_SPINNER && state.ANIMATE?'show':'hide']();
      spinButton.disabled = !state.SHOW_SPINNER || !state.ANIMATE;
      var showSeconds=!!(state.SHOW_SPINNER && state.SECOND_HAND);
      document.getElementById('cat-preview-seconds-field').hidden=!showSeconds;secondsButton.hidden=!showSeconds;
      secondsInput.disabled=!showSeconds;secondsButton.disabled=!showSeconds;
      var secondsNote=clay.getItemById('seconds-note');if(secondsNote)secondsNote[showSeconds?'show':'hide']();
      var caption=window.returnTo==='#'?'Browser demo: sample weather. Install the watchface to save settings to your watch.':'Sample weather. Save settings to apply changes.';
      if(state.TIME_FORMAT===0)caption+=' Watch format uses a 24-hour example here.';
      document.getElementById('cat-preview-caption').textContent=caption;
      stop(true);syncSeconds();
    }
    function count(){return state.SPOKES || 8;}
    function secondsNow(){
      return ((secondsBase+(secondsPlaying?Date.now()-secondsEpoch:0))%60000+60000)%60000;
    }
    function stopSeconds(){if(secondsTimer!==null)clearTimeout(secondsTimer);secondsTimer=null;}
    function syncSeconds(){
      stopSeconds();var ms=secondsNow();
      var sample=(Math.floor(ms/100)/10).toFixed(1);secondsInput.value=sample;secondsValue.textContent=sample;
      secondsButton.textContent=secondsPlaying?'Pause seconds':'Play seconds';
      if(!state.SHOW_SPINNER || !state.SECOND_HAND || running || document.hidden){draw();return;}
      phase=Math.floor(ms*count()/60000);draw();
      if(secondsPlaying){
        var delay=Math.ceil((phase+1)*60000/count())-ms;
        secondsTimer=setTimeout(syncSeconds,Math.max(1,delay));
      }
    }
    function animate(){
      if(spinButton.disabled)return;
      // A new flick starts a fresh coast from the visible position.
      stopSeconds();stop(false);running=true;
      var fast=state.SPIN_MOTION===1,n=count(),frames=fast?32:n;
      var duration=state.SPIN_LENGTH===1?4000:(state.SPIN_LENGTH===2?2000:3000);
      var weights=[],total=0,prefix=0;
      for(var i=0;i<frames;i++){
        var weight=fast?(i===0?0:45+Math.floor(355*i*i/961)):300+Math.floor(500*i*i/((n-1)*(n-1)));
        weights.push(weight);total+=weight;
      }
      function tick(){
        timer=null;phase=(phase+1)%n;step++;
        if(step===frames)running=false;
        if(running){draw();schedule();}else syncSeconds();
      }
      function schedule(){
        var weight=weights[step];
        var delay=Math.floor(duration*(prefix+weight)/total)-Math.floor(duration*prefix/total);
        prefix+=weight;timer=setTimeout(tick,delay);
      }
      if(fast)tick();else{draw();schedule();}
    }
    function font(key){return assets.fonts[key];}
    function width(text,f){var result=0;for(var i=0;i<text.length;i++)result+=f.glyphs[text[i]].advance;return result;}
    function text(textValue,f,x,y,align,boxWidth,color,outline){
      x+=align==='right'?boxWidth-width(textValue,f):(align==='center'?Math.floor((boxWidth-width(textValue,f))/2):0);
      function paint(dx,dy,ink){ctx.fillStyle=ink;var cursor=x;for(var i=0;i<textValue.length;i++) {var g=f.glyphs[textValue[i]];g.rows.forEach(function(row,yy){for(var xx=0;xx<row.length;xx++)if(row[xx]==='1')ctx.fillRect(cursor+g.x+xx+dx,y+g.y+yy+dy,1,1);});cursor+=g.advance;}}
      if(outline)for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++)if(dx||dy)paint(dx,dy,outline);
      paint(0,0,color);
    }
    function draw(){
      if(!Object.keys(state).length)return;
      var m=assets.models[platform],w=m.w,h=m.h,big=w>=200,round=platform==='chalk'||platform==='gabbro';
      if(canvas.width!==w || canvas.height!==h){canvas.width=w;canvas.height=h;}
      canvas.style.width=w+'px';panel.classList.toggle('cat-preview-wide',w>200);canvas.style.borderRadius=round?'50%':'0';ctx.imageSmoothingEnabled=false;
      var mono=['aplite','diorite','flint'].indexOf(platform)>=0,cream=mono?'#fff':'#ffffaa';
      ctx.fillStyle=cream;ctx.fillRect(0,0,w,h);
      var shift=round?(big?48:34):7;
      if(images[platform] && images[platform].complete)ctx.drawImage(images[platform],shift,0);
      var nose=clay.meta.userData.nose;
      if(mono && state.GRAY_NOSE && nose){
        nose.rows.forEach(function(row,y){
          for(var x=0;x<row.length;x++)if(row[x]==='1'){
            var px=nose.x+shift+x,py=nose.y+y;
            ctx.fillStyle=nose.bayer[py&3][px&3]<nose.coverage?'#fff':'#000';
            ctx.fillRect(px,py,1,1);
          }
        });
      }
      if(state.SHOW_SPINNER){
        var settings={aplite:[66,49,74],basalt:[66,49,74],chalk:[82,56,85],diorite:[66,49,74],emery:[90,67,100],flint:[66,49,74],gabbro:[119,81,132]}[platform];
        var cx=settings[0]+shift,cy=settings[1],scale=settings[2];
        var lengths=[16,16,15,14,13,12,12,13],brightness=[255,255,170,170,85,85,85,85];
        var bayer=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
        function scaled(n){return Math.floor((n*scale+50)/100);}
        function truncate(n){return n<0?Math.ceil(n):Math.floor(n);}
        function capsule(a,b,r,level){
          var vx=b[0]-a[0],vy=b[1]-a[1],length2=vx*vx+vy*vy,r2=r*r;
          var threshold=level===255?16:(level===170?11:5);
          if(!mono)ctx.fillStyle=level===255?'#fff':(level===170?'#aaa':'#555');
          for(var y=Math.min(a[1],b[1])-r;y<=Math.max(a[1],b[1])+r;y++){
            for(var x=Math.min(a[0],b[0])-r;x<=Math.max(a[0],b[0])+r;x++){
              var dx=x-a[0],dy=y-a[1],dot=dx*vx+dy*vy,inside;
              if(dot<=0)inside=dx*dx+dy*dy<=r2;
              else if(dot>=length2){dx=x-b[0];dy=y-b[1];inside=dx*dx+dy*dy<=r2;}
              else{var cross=dx*vy-dy*vx;inside=cross*cross<=r2*length2;}
              if(!inside)continue;
              if(mono)ctx.fillStyle=bayer[y&3][x&3]<threshold?'#fff':'#000';
              ctx.fillRect(x,y,1,1);
            }
          }
        }
        for(var i=0;i<count();i++){
          var age=(phase-i+count())%count(),bucket=Math.floor(age*8/count()),angle=i*Math.PI*2/count();
          var vx=Math.round(Math.sin(angle)*1000),vy=Math.round(-Math.cos(angle)*1000);
          var inner=scaled(15),outer=inner+scaled(lengths[bucket]);
          var a=[cx+truncate(vx*inner/1000),cy+truncate(vy*inner/1000)];
          var b=[cx+truncate(vx*outer/1000),cy+truncate(vy*outer/1000)];
          capsule(a,b,Math.floor(Math.max(2,scaled(4))/2),brightness[bucket]);
        }
      }
      var parts=(timeInput.value||'16:49').split(':'),hour=Number(parts[0]),minutes=parts[1]||'49';
      var twelve=state.TIME_FORMAT===1 || (state.TIME_FORMAT===0 && clay.meta.userData.twelveHour);
      if(twelve)hour=hour%12||12;
      var hours=(state.LEADING_ZERO && hour<10?'0':'')+hour;
      var family='n'+state.NUMERAL_FONT+'-',margin=round?(big?42:30):(big?5:4);
      var inset=round?(big?43:26):(big?8:5),tempWidth=big?63:48;
      var size=big?30:22,line=big?38:28,sf=font(family+size);
      var left=Math.min(sf.glyphs[hours[0]].x+(hours.length===1?Math.floor(size/4):0),sf.glyphs[minutes[0]].x);
      var x=margin-left,y=h-margin-size-line;
      text(hours,sf,x,y,'center',size,'#000',null);
      text(minutes,sf,x,y+line,'center',size,'#000',null);
      if(state.SHOW_WEATHER){
        var tempSize=big?22:18,temp=state.FAHRENHEIT?'88°':'31°';
        var tempFont=font(family+tempSize),tx=w-inset-tempWidth+(big?2:1),ty=h-margin-tempSize;
        if(width(temp,tempFont)>tempWidth){var smaller=big?18:16;tempFont=font(family+smaller);ty+=tempSize-smaller;}
        text(temp,tempFont,tx,ty,'right',tempWidth,cream,'#000');
      }
      canvas.setAttribute('data-font',String(state.NUMERAL_FONT));canvas.setAttribute('data-weather',String(state.SHOW_WEATHER));canvas.setAttribute('data-phase',String(phase));canvas.setAttribute('data-step',String(step));canvas.setAttribute('data-animating',String(running));
      canvas.setAttribute('aria-label',names[platform]+' preview, '+hours+':'+minutes+(state.SHOW_WEATHER?', sample '+(state.FAHRENHEIT?'88 Fahrenheit':'31 Celsius'): ', temperature hidden'));
    }
    Object.keys(items).forEach(function(key){items[key].on('change',update);});
    modelSelect.onchange=function(){platform=modelSelect.value;update();};timeInput.oninput=draw;spinButton.onclick=animate;canvas.onclick=animate;
    secondsInput.oninput=function(){secondsBase=Number(secondsInput.value)*1000;secondsEpoch=Date.now();syncSeconds();};
    secondsButton.onclick=function(){secondsBase=secondsNow();secondsEpoch=Date.now();secondsPlaying=!secondsPlaying;syncSeconds();};
    var reset=document.createElement('button');reset.type='button';reset.className='cat-reset';reset.textContent='Reset to defaults';
    reset.onclick=function(){secondsBase=0;secondsEpoch=Date.now();secondsPlaying=true;Object.keys(items).forEach(function(key){items[key].set(items[key].config.defaultValue);});update();};
    var submit=clay.getItemsByType('submit')[0];if(submit && submit.$element[0])submit.$element[0].parentNode.insertBefore(reset,submit.$element[0]);
    window.addEventListener('pagehide',function(){stop(false);stopSeconds();});
    window.addEventListener('pageshow',syncSeconds);
    document.addEventListener('visibilitychange',function(){if(document.hidden){stop(false);stopSeconds();draw();}else syncSeconds();});
    update();
  });
};
