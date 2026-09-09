// Opt-in live check: contacts Open-Meteo using only public example locations.
// node tests/location-live.test.js [report.json]
const assert=require('node:assert/strict'),fs=require('node:fs'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile),location=require('../src/pkjs/location'),cases=require('./city-cases.json');
let cursor=0;const report=[];
async function check(c){
 const place=location.parse(c.input),queries=location.searches(place,c.locale),choices=[];let automatic=null,count=0;
 for(const query of queries){
  const url='https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:query.name,countryCode:place.country,count:20,language:query.language,format:'json'});
  const {stdout}=await run('curl',['-fsSL','--max-time','20',url]);count++;
  const found=location.candidates(JSON.parse(stdout).results,place);
  found.forEach(r=>{if(!choices.some(c=>c.id===r.id))choices.push(r);});
  automatic=location.find(found,place,query);if(location.matches(found,place,query).length)break;
 }
 const matched=choices.find(r=>r.id===c.expectedId);
 if(c.expectedId===null)assert.equal(choices.length,0,c.input+' must remain unresolved');
 else assert(matched,c.input+' did not offer expected place '+c.expectedId);
 if(matched){const encoded=location.encodeSelection(matched,c.input),saved=location.selection({WEATHER_CITY:c.input,WEATHER_PLACE:encoded});assert.equal(saved.id,c.expectedId);}
 report.push({...c,passed:true,requests:count,automaticId:automatic?.id||null,choices:choices.map(r=>({id:r.id,name:r.name,region:r.admin1,country:r.country_code}))});
 console.log('Passed '+c.input+' ('+count+' request'+(count===1?'':'s')+')');
}
async function worker(){while(cursor<cases.length)await check(cases[cursor++]);}
Promise.all([worker(),worker()]).then(()=>{if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({cases:report.length,passed:true,results:report},null,2)+'\n');console.log('Live public location checks passed: '+report.length);}).catch(e=>{console.error(e);process.exitCode=1;});
