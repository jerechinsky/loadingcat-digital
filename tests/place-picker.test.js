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

const features=[
 {type:'Feature',geometry:{type:'Point',coordinates:[-73.9497211,40.6526006]},properties:{osm_type:'R',osm_id:9691750,osm_key:'place',type:'district',name:'Brooklyn',city:'New York',country:'United States',countrycode:'US'}},
 {type:'Feature',geometry:{type:'Point',coordinates:[-73.9950297,40.6960849]},properties:{osm_type:'W',osm_id:244581129,osm_key:'place',type:'locality',name:'Brooklyn Heights',district:'Brooklyn',city:'New York',country:'United States',countrycode:'US'}}
];
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));let mode='success',pending;
 await page.route('**/*',async route=>{
  const url=route.request().url();if(url.startsWith('https://settings.test/'))return route.fulfill({body:'Saved'});
  assert(url.startsWith('https://photon.komoot.io/api/?'));requests.push(url);
  if(mode==='defer'){pending=route;return;}
  if(mode==='offline')return route.abort();
  if(mode==='broken')return route.fulfill({status:200,body:'invalid'});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features:mode==='empty'?[]:[...features,{...features[0],properties:{...features[0].properties,osm_id:9,osm_key:'shop',type:'house'}}]})});
 });
 async function load(p){await page.setContent(p.html().replace('window.returnTo="pebblejs://close#"','window.returnTo="https://settings.test/close#"'));}
 const row=label=>page.locator('.component-input,.component-select,.component-toggle').filter({has:page.getByText(label,{exact:true})});
 const field=label=>row(label).locator('[data-manipulator-target]');
 const results=()=>page.getByRole('group',{name:'Place suggestions'});
 async function toggle(label,v){await field(label).evaluate((e,v)=>{e.checked=v;e.dispatchEvent(new Event('change',{bubbles:true}));},v);}
 async function save(p){await page.getByRole('button',{name:'Save settings'}).click();await page.waitForURL('https://settings.test/close#**');p.fire('webviewclosed',{response:page.url().split('#')[1]});return JSON.parse(p.store['loading-cat-settings-v1']);}
 let p=phone();await load(p);assert.equal(requests.length,0);assert.equal(await page.getByRole('button',{name:'Find place'}).count(),0);assert.equal(await page.getByText('Choose a place',{exact:true}).count(),0);
 await field('Weather location').selectOption('1');assert.equal(requests.length,0);
 await field('Search place').fill('Br');await page.waitForTimeout(200);await field('Search place').fill('Brooklyn');await page.waitForTimeout(200);await field('Search place').fill('Brooklyn New York');await page.waitForTimeout(600);assert.equal(requests.length,0,'Do not search every keystroke');
 await results().waitFor({state:'visible'});assert.equal(requests.length,1);assert.equal(new URL(requests[0]).searchParams.get('q'),'Brooklyn New York');assert(!new URL(requests[0]).searchParams.has('countrycode'));
 assert.equal(await results().getByRole('button').count(),2);assert.equal(await field('Saved place').inputValue(),'','No result is silently selected');
 assert.match(await results().innerText(),/Brooklyn\nNew York, United States/);
 await row('Search place').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'place-search.png')});
 await results().getByRole('button',{name:'Brooklyn New York, United States',exact:true}).click();assert(!await results().isVisible());assert((await page.getByRole('status').innerText()).includes('Selected: Brooklyn'));
 let saved=await save(p);assert.equal(JSON.parse(saved.WEATHER_PLACE).id,'osm:R:9691750');assert(p.messages.every(m=>m.WEATHER_PLACE===undefined));
 p=phone(p.store);await load(p);await page.waitForTimeout(1000);assert.equal(requests.length,1,'Opening saved settings is offline');assert.match(await page.getByRole('status').innerText(),/Selected: Brooklyn/);
 // Hiding weather cancels even the pending debounce, before a request starts.
 await field('Search place').fill('New place');await toggle('Show temperature',false);await page.waitForTimeout(1000);assert.equal(requests.length,1);await toggle('Show temperature',true);
 assert.equal(await field('Saved place').inputValue(),'');
 mode='defer';await field('Search place').fill('Old place');await field('Search place').press('Enter');await page.getByRole('status').filter({hasText:'Searching…'}).waitFor({state:'visible'});
 await field('Search place').fill('x');if(pending)await pending.fulfill({status:200,contentType:'application/json',body:JSON.stringify({features})});assert(!await results().isVisible());assert.equal(await field('Saved place').inputValue(),'');
 mode='offline';await field('Search place').fill('Offline town');await field('Search place').press('Enter');await page.getByText('Could not reach place search. Check your connection and try again.',{exact:true}).waitFor({state:'visible'});
 mode='broken';await field('Search place').fill('Broken town');await field('Search place').press('Enter');await page.getByText('Could not read the search results. Try again.',{exact:true}).waitFor({state:'visible'});
 mode='empty';await field('Search place').fill('Unknown town');await field('Search place').press('Enter');await page.getByText('No places found. Try the neighborhood and city, or another spelling.',{exact:true}).waitFor({state:'visible'});
 // IME composition must finish before a Japanese/Chinese name is searched.
 mode='success';const before=requests.length;await field('Search place').evaluate(e=>e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true})));await field('Search place').fill('東京');await page.waitForTimeout(1000);assert.equal(requests.length,before);
 await field('Search place').evaluate(e=>e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await results().waitFor({state:'visible'});assert.equal(requests.length,before+1);
 await field('Search place').fill('x');await field('Search place').fill('東京');await results().waitFor({state:'visible'});assert.equal(requests.length,before+1,'Repeat searches reuse page cache');
 for(const width of [320,390,480]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const boxes=await results().getByRole('button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert(boxes.every(h=>h>=44));}
 let liveLookup=false;
 if(process.env.LIVE_PLACE_LOOKUP==='1'){
  await page.unroute('**/*');p=phone();await page.setViewportSize({width:390,height:844});await page.goto('data:text/html;charset=utf-8,'+encodeURIComponent(p.html()));
  await field('Weather location').selectOption('1');await field('Search place').fill('Brooklyn New York');await results().waitFor({state:'visible',timeout:20000});
  const brooklyn=results().getByRole('button').filter({has:page.getByText('Brooklyn',{exact:true})});assert(await brooklyn.count()>=1);
  await row('Search place').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'place-search-live.png')});await brooklyn.first().click();assert.equal(JSON.parse(await field('Saved place').inputValue()).id,'osm:R:9691750');liveLookup=true;
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'picker-verification.json'),JSON.stringify({live_lookup_from_data_uri:liveLookup,no_find_button:true,no_dropdown:true,debounced_search:true,ime_composition:true,page_cache:true,neighborhood_labels:true,tap_to_choose:true,save_reopen:true,phone_only:true,edit_invalidates_selection:true,late_response_cancelled:true,hidden_cancels_debounce:true,offline_error:true,malformed_error:true,no_results:true,widths:[320,390,480]},null,2)+'\n');
 console.log('Place search passed: debounce, IME, cache, neighborhood results, tap/select/save/reopen, cancellation, offline/malformed/empty responses and mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
