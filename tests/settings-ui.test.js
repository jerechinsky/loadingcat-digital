// Run after pebble build, with PLAYWRIGHT_MODULE and CHROME_PATH if needed.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=process.env.PREVIEW_OUTPUT||path.join(root,'../../work/settings-qa');
fs.mkdirSync(out,{recursive:true});
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const config=JSON.parse(fs.readFileSync(path.join(root,'src/pkjs/config.json'),'utf8'));
const specs=Object.fromEntries(config.flatMap(s=>s.items||[]).filter(i=>i.messageKey).map(i=>[i.messageKey,i]));
const defaults=Object.fromEntries(Object.entries(specs).map(([k,s])=>[k,Number(s.defaultValue)]));
const bundle=fs.readFileSync(path.join(root,'build/pebble-js-app.js'),'utf8');
function phone(saved={},platform='emery'){
 const events={},store={...saved},messages=[];let url;
 const context={console,setTimeout,clearTimeout,setInterval,clearInterval,localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},
 Pebble:{platform:'ios',getActiveWatchInfo:()=>({platform}),getAccountToken:()=>'',getWatchToken:()=>'',addEventListener:(n,f)=>(events[n]||(events[n]=[])).push(f),sendAppMessage:p=>messages.push(p),openURL:u=>url=u},navigator:{},XMLHttpRequest:function(){throw Error('Settings must not fetch weather');}};
 vm.createContext(context);vm.runInContext(bundle,context);
 function fire(name,data){for(const f of events[name]||[])f(data);}fire('ready');
 return {fire,store,messages,html(){fire('showConfiguration');assert(url.startsWith('data:text/html'));return decodeURIComponent(url.slice(url.indexOf(',')+1));}};
}
(async()=>{
 assert.equal(Object.keys(specs).length,18);
 assert.doesNotMatch(bundle,/cat-preview-canvas|cat-preview-seconds|Live watchface preview/,'Development preview is absent from the shipped bundle');
 for(const retired of ['STYLE','SHOW_TIME','TIME_LAYOUT','FONT_STYLE','COMPACT','DARK_TEXT','OUTLINE'])assert(!Object.hasOwn(specs,retired),retired+' is not a public setting');
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(r.request().url().startsWith('https://settings.test/'))return r.fulfill({body:'Saved in test'});requests.push(r.request().url());return r.abort();});
 async function load(html){await page.setContent(html.replace('window.returnTo="pebblejs://close#"','window.returnTo="https://settings.test/close#"'),{waitUntil:'load'});}
 // Use the stock Clay label and manipulator structure, without test hooks in production.
 const row=k=>page.locator('.component-toggle,.component-select').filter({has:page.getByText(specs[k].label,{exact:true})});
 const field=k=>row(k).locator('[data-manipulator-target]');
 async function value(k){return specs[k].type==='toggle'?Number(await field(k).isChecked()):Number(await field(k).inputValue());}
 async function set(k,v){if(specs[k].type==='toggle')await field(k).evaluate((e,v)=>{e.checked=!!v;e.dispatchEvent(new Event('change',{bubbles:true}));},v);else await field(k).selectOption(String(v));}
 async function save(ph){await page.getByRole('button',{name:'Save settings'}).click();await page.waitForURL('https://settings.test/close#**');ph.fire('webviewclosed',{response:page.url().split('#')[1]});return JSON.parse(ph.store['loading-cat-settings-v1']);}
 async function checkStock(){
  assert.equal(await page.locator('input[data-manipulator-target],select[data-manipulator-target]').count(),18);
  assert.equal(await page.locator('canvas,.cat-preview,.cat-reset,input[type=time],input[type=range],[id^="cat-preview-"]').count(),0);
  assert.equal(await page.getByRole('button').count(),1,'Save is the only button');
  assert.equal(await page.getByRole('button',{name:'Save settings'}).count(),1);
  assert.doesNotMatch(await page.locator('body').innerText(),/Example time|Example seconds|Play seconds|Pause seconds|Test animation|Reset to defaults|Live preview|Browser demo/);
  assert.match(await page.locator('body').innerText(),/Digital adaptation by yerex\./);
  assert.equal(await page.getByRole('link',{name:'zbw / zbzbw'}).getAttribute('href'),'https://github.com/zbzbw/loadingcat-pebble');
 }
 let ph=phone();const defaultHtml=ph.html();await load(defaultHtml);await checkStock();
 for(const [k,v] of Object.entries(defaults))assert.equal(await value(k),v,k+' default');
 assert.equal(await value('SPOKES'),8);assert.equal(await value('SPIN_MOTION'),1);assert.equal(await value('SPIN_LENGTH'),0);assert.equal(await value('SECOND_HAND'),1);
 assert.equal(await value('NIGHT_PAUSE'),0);
 assert(!await row('NIGHT_START').isVisible());
 await set('NIGHT_PAUSE',1);assert(await row('NIGHT_START').isVisible());assert(await row('NIGHT_END').isVisible());
 await set('ANIMATE',0);assert(!await row('NIGHT_START').isVisible());await set('ANIMATE',1);
 await set('NIGHT_PAUSE',0);
 const options=key=>field(key).locator('option').evaluateAll(es=>es.map(e=>[e.value,e.textContent]));
 assert.deepEqual(await options('SPOKES'),[['6','6'],['7','7'],['8','8'],['10','10'],['12','12']]);
 assert.deepEqual(await options('NUMERAL_FONT'),[['0','Teko'],['2','Bebas Neue'],['7','Square'],['8','Square Cut']]);
 assert.deepEqual(await options('SPIN_MOTION'),[['0','Slow loading'],['1','Fast spin']]);
 assert.deepEqual(await options('SPIN_LENGTH'),[['2','2 seconds'],['0','3 seconds'],['1','4 seconds']]);
 for(const width of [320,390,480]){await page.setViewportSize({width,height:width===320?568:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Stock form overflows at '+width);}
 await page.setViewportSize({width:390,height:844});
 const capabilityChecks=[];
 for(const [model,nose] of [['aplite',0],['basalt',1],['chalk',0],['diorite',1],['emery',0],['flint',0],['gabbro',1]]){
  const preferences={...defaults,GRAY_NOSE:nose,LIGHT_TRIGGER:0};
  ph=phone({'loading-cat-settings-v1':JSON.stringify(preferences)},model);await load(ph.html());await checkStock();
  const mono=['aplite','diorite','flint'].includes(model),light=['emery','flint','gabbro'].includes(model);
  assert.equal(await row('GRAY_NOSE').isVisible(),mono);assert.equal(await field('GRAY_NOSE').isEnabled(),mono);
  assert.equal(await row('LIGHT_TRIGGER').isVisible(),light);assert.equal(await field('LIGHT_TRIGGER').isEnabled(),light);
  assert.equal(await page.getByText('Back starts a spin when it wakes the light. Other backlight activations can also trigger it.',{exact:true}).isVisible(),light);
  await set('SHOW_SPINNER',0);
  for(const key of ['SPOKES','SECOND_HAND','ANIMATE','FLICK_TRIGGER','LIGHT_TRIGGER','SPIN_MOTION','SPIN_LENGTH'])assert(!await row(key).isVisible(),key+' hides with spinner');
  assert(!await page.getByText('One turn per minute, in spoke-sized steps.',{exact:true}).isVisible());
  await set('SHOW_SPINNER',1);await set('ANIMATE',0);
  for(const key of ['FLICK_TRIGGER','LIGHT_TRIGGER','SPIN_MOTION','SPIN_LENGTH'])assert(!await row(key).isVisible(),key+' hides with interaction');
  assert(await row('SECOND_HAND').isVisible(),'Seconds remain independent of interaction animation');
  await set('SECOND_HAND',0);assert(!await page.getByText('One turn per minute, in spoke-sized steps.',{exact:true}).isVisible());await set('SECOND_HAND',1);await set('ANIMATE',1);
  await set('SHOW_WEATHER',0);assert(!await row('FAHRENHEIT').isVisible());assert(!await row('WEATHER_INTERVAL').isVisible());assert(await row('NUMERAL_FONT').isVisible());await set('SHOW_WEATHER',1);
  assert(await row('FAHRENHEIT').isVisible());assert(await row('WEATHER_INTERVAL').isVisible());
  const saved=await save(ph);assert.deepEqual(saved,preferences,'Hidden/disabled preferences survive Save on '+model);
  ph=phone(ph.store,model);await load(ph.html());assert.equal(await value('LIGHT_TRIGGER'),0,'False backlight preference survives reopen on '+model);assert.equal(await value('GRAY_NOSE'),nose,'Nose preference survives reopen on '+model);
  capabilityChecks.push({model,monochrome_nose:mono,backlight:light,hidden_preferences_preserved:true});
 }
 // Exercise every legal choice on a model where its corresponding control applies.
 ph=phone({},'flint');await load(ph.html());
 const exercised={};
 for(const [k,spec] of Object.entries(specs)){
  for(const parent of ['SHOW_SPINNER','ANIMATE','SHOW_WEATHER'])await set(parent,1);
  const choices=spec.type==='toggle'?[0,1]:spec.options.map(o=>Number(o.value));
  for(const choice of choices){await set(k,choice);assert.equal(await value(k),choice,k+' choice');}
  exercised[k]=choices;
 }
 const expected={NIGHT_PAUSE:1,NIGHT_START:23,NIGHT_END:8,SECOND_HAND:0,GRAY_NOSE:0,SHOW_WEATHER:0,SHOW_SPINNER:0,NUMERAL_FONT:8,TIME_FORMAT:2,LEADING_ZERO:0,SPOKES:12,SPIN_MOTION:0,ANIMATE:0,FLICK_TRIGGER:0,LIGHT_TRIGGER:0,SPIN_LENGTH:2,FAHRENHEIT:1,WEATHER_INTERVAL:60};
 // Set hidden select values directly, as saved preferences can remain hidden.
 for(const [k,v] of Object.entries(expected))await field(k).evaluate((e,v)=>{if(e.type==='checkbox')e.checked=!!v;else e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}));},v);
 assert.deepEqual(await save(ph),expected);ph=phone(ph.store,'flint');await load(ph.html());for(const [k,v] of Object.entries(expected))assert.equal(await value(k),v,k+' persists');
 await load(defaultHtml);await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:path.join(out,'settings-full.png'),fullPage:true});await page.screenshot({path:path.join(out,'settings.png')});await page.screenshot({path:path.join(out,'settings-preview.png')});
 const demo=defaultHtml.replace('window.returnTo="pebblejs://close#"','window.returnTo="#"');
 await load(demo);await checkStock();
 fs.writeFileSync(path.join(out,'settings.html'),demo);fs.writeFileSync(path.join(out,'settings-preview.html'),demo);
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({settings:18,stock_clay:true,preview_absent:true,custom_chrome_absent:true,models:7,breakpoints:[320,390,480],offline:true,save_and_reopen:true,all_options:true,conditional_visibility:true,model_capabilities:true,hidden_preferences_preserved:true,capability_checks:capabilityChecks,choices_tested:exercised},null,2)+'\n');
 console.log('Stock Clay checks passed:18 settings, all choices,7 model capabilities, conditional visibility, hidden preference persistence, offline load and responsive form.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
