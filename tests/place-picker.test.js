// Exercises the shipped Clay bundle, including persistence and cancelled lookups.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.PREVIEW_OUTPUT||path.join(root,'../../work/place-picker');fs.mkdirSync(out,{recursive:true});
const bundle=fs.readFileSync(path.join(root,'build/pebble-js-app.js'),'utf8');
function phone(saved={}){
 const events={},store={...saved},messages=[];let url;
 const context={console,setTimeout,clearTimeout,setInterval,clearInterval,localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},
 Pebble:{platform:'ios',getActiveWatchInfo:()=>({platform:'emery'}),getAccountToken:()=>'',getWatchToken:()=>'',addEventListener:(n,f)=>(events[n]||(events[n]=[])).push(f),sendAppMessage:p=>messages.push(p),openURL:u=>url=u},navigator:{},XMLHttpRequest:function(){throw Error('Settings must not fetch weather');}};
 vm.createContext(context);vm.runInContext(bundle,context);
 function fire(name,data){for(const f of events[name]||[])f(data);}fire('ready');
 return {fire,store,messages,html(){fire('showConfiguration');return decodeURIComponent(url.slice(url.indexOf(',')+1));}};
}
const towns=[{id:4250542,name:'Springfield',admin1:'Illinois',country:'United States',country_code:'US',feature_code:'PPLA',latitude:39.80172,longitude:-89.64371},{id:4951788,name:'Springfield',admin1:'Massachusetts',country:'United States',country_code:'US',feature_code:'PPL',latitude:42.10148,longitude:-72.58981}];
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));let mode='success',pending;
 await page.route('**/*',async route=>{
  const url=route.request().url();if(url.startsWith('https://settings.test/'))return route.fulfill({body:'Saved'});
  assert(url.startsWith('https://geocoding-api.open-meteo.com/v1/search?'));requests.push(url);
  if(mode==='defer'){pending=route;return;}
  if(mode==='offline')return route.abort();
  if(mode==='broken')return route.fulfill({status:200,body:'invalid'});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:mode==='empty'?[]:[...towns,{...towns[0],id:8,country_code:'CA'},{...towns[0],id:9,feature_code:'ADM1'}]})});
 });
 async function load(p){await page.setContent(p.html().replace('window.returnTo="pebblejs://close#"','window.returnTo="https://settings.test/close#"'));}
 const row=label=>page.locator('.component-input,.component-select,.component-toggle').filter({has:page.getByText(label,{exact:true})});
 const field=label=>row(label).locator('[data-manipulator-target]');
 async function toggle(label,v){await field(label).evaluate((e,v)=>{e.checked=v;e.dispatchEvent(new Event('change',{bubbles:true}));},v);}
 async function save(p){await page.getByRole('button',{name:'Save settings'}).click();await page.waitForURL('https://settings.test/close#**');p.fire('webviewclosed',{response:page.url().split('#')[1]});return JSON.parse(p.store['loading-cat-settings-v1']);}
 let p=phone();await load(p);assert.equal(requests.length,0);assert(!await page.getByRole('button',{name:'Find place'}).isVisible());
 await field('Weather location').selectOption('1');await field('City').fill('Springfield, US');assert.equal(requests.length,0);
 await page.getByRole('button',{name:'Find place',exact:true}).click();await row('Choose a place').waitFor({state:'visible'});
 assert.equal(requests.length,1);assert.equal(new URL(requests[0]).searchParams.get('countryCode'),'US');
 assert.deepEqual(await field('Choose a place').locator('option').allTextContents(),['Choose a match','Springfield, Illinois, United States','Springfield, Massachusetts, United States']);
 assert.equal(await field('Choose a place').inputValue(),'','No place is silently selected');
 await field('Choose a place').selectOption('1');await page.getByText('Selected: Springfield, Massachusetts, United States. Tap Save settings to use it.',{exact:true}).waitFor({state:'visible'});
 await row('City').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'place-picker.png')});
 let saved=await save(p);assert.equal(JSON.parse(saved.WEATHER_PLACE).id,4951788);assert(p.messages.every(m=>m.WEATHER_PLACE===undefined));
 p=phone(p.store);await load(p);assert.equal(requests.length,1);assert(await page.getByText('Selected: Springfield, Massachusetts, United States',{exact:true}).isVisible());
 // Merely opening, typing, hiding or saving weather never does a lookup.
 await field('City').fill('Paris, FR');assert.equal(requests.length,1);assert.equal(await field('Saved place').inputValue(),'');
 await toggle('Show temperature',false);assert(!await page.getByRole('button',{name:'Find place',exact:true}).isVisible());await toggle('Show temperature',true);
 await field('City').fill('Paris');await page.getByRole('button',{name:'Find place',exact:true}).click();assert.equal(requests.length,1);assert(await page.getByText('Enter city, country code. For example: Prague, CZ.',{exact:true}).isVisible());
 await field('City').fill('Springfield, US');mode='defer';await page.getByRole('button',{name:'Find place',exact:true}).click();await page.getByRole('button',{name:'Searching…',exact:true}).waitFor({state:'visible'});
 await field('City').fill('London, GB');if(pending)await pending.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:towns})});assert(!await row('Choose a place').isVisible());assert.equal(await field('Saved place').inputValue(),'');
 mode='offline';await page.getByRole('button',{name:'Find place',exact:true}).click();await page.getByText('Could not reach place lookup. Check your connection and try again.',{exact:true}).waitFor({state:'visible'});
 mode='broken';await page.getByRole('button',{name:'Find place',exact:true}).click();await page.getByText('Place lookup returned an unreadable response. Try again.',{exact:true}).waitFor({state:'visible'});
 mode='empty';await page.getByRole('button',{name:'Find place',exact:true}).click();await page.getByText('No places found. Try the full name or English spelling.',{exact:true}).waitFor({state:'visible'});
 for(const width of [320,390,480]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(errors,[]);
 let liveLookup=false;
 if(process.env.LIVE_PLACE_LOOKUP==='1'){
  await page.unroute('**/*');
  p=phone();await page.goto('data:text/html;charset=utf-8,'+encodeURIComponent(p.html()));
  await field('Weather location').selectOption('1');await field('City').fill('Prague, CZ');
  await page.getByRole('button',{name:'Find place',exact:true}).click();
  await row('Choose a place').waitFor({state:'visible',timeout:35000});
  const names=await field('Choose a place').locator('option').allTextContents();assert(names.some(n=>n.includes('Praha')||n.includes('Prague')));
  await field('Choose a place').selectOption('0');assert(JSON.parse(await field('Saved place').inputValue()).id===3067696);
  await row('City').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'place-picker-live.png')});liveLookup=true;
 }
 fs.writeFileSync(path.join(out,'picker-verification.json'),JSON.stringify({live_lookup_from_data_uri:liveLookup,stock_controls:true,explicit_search:true,ambiguous_results:true,region_and_country:true,no_automatic_selection:true,save_reopen:true,phone_only:true,edit_invalidates_selection:true,late_response_cancelled:true,offline_error:true,malformed_error:true,no_results:true,widths:[320,390,480]},null,2)+'\n');
 console.log('Place picker passed: explicit search, region/country choices, save/reopen, no GPS, late cancellation, hidden controls, offline/malformed/empty responses and responsive layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
