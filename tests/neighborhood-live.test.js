// Opt-in Photon checks against public place coordinates. No phone location used.
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),location=require('../src/pkjs/location');
const cases=[['Brooklyn, New York',40.6526,-73.9497],['Shibuya Tokyo',35.6634,139.6965],['Київ Оболонь',50.5107,30.5034],['Prague, CZ',50.0875,14.4213],['nyc, usa',40.71,-74.0],['san francisco, us',37.7879,-122.4075],['Dolní Věstonice, CZ',48.8872,16.6439],['北京',39.9057,116.3913],['東京都',35.68,139.76],['Brooklyn, NY',40.6526,-73.9497]];
const results=[];
for(const [input,lat,lon] of cases){
 const body=JSON.parse(execFileSync('curl',['-fsSL','--max-time','20',location.suggestionUrl(input)],{encoding:'utf8'}));
 const choices=location.suggestions(body,input),match=choices.find(r=>Math.abs(r.latitude-lat)<0.12 && Math.abs(r.longitude-lon)<0.12);assert(match,'Expected location missing: '+input);
 const selected=location.selection({WEATHER_CITY:input,WEATHER_PLACE:location.encodeSelection(match,input)});assert(selected && selected.id===match.id);
 results.push({input,id:match.id,name:match.name,region:match.admin2,country:match.country_code,passed:true});console.log('Passed '+input);
}
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({provider:'Photon / OpenStreetMap contributors',cases:results.length,passed:true,results},null,2)+'\n');
