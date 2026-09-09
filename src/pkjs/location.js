function createLocation() {
var exports={};
/* Phone-only city input and stable weather-cache identity. */
var COUNTRY_ALIASES={USA:'US',UK:'GB',GBR:'GB',CZE:'CZ',UKR:'UA',CHN:'CN',JPN:'JP'};
var LOCAL_LANGUAGES={CZ:'cs',SK:'sk',PL:'pl',DE:'de',AT:'de',CH:'de fr it',LI:'de',FR:'fr',BE:'nl fr de',NL:'nl',LU:'fr de',IT:'it',ES:'es',PT:'pt',BR:'pt',CA:'en fr',MX:'es',AR:'es',CL:'es',CO:'es',CR:'es',PE:'es',EC:'es',UY:'es',VE:'es',GT:'es',CU:'es',DO:'es',PA:'es',BO:'es',PY:'es',SV:'es',HN:'es',NI:'es',DK:'da',NO:'no',SE:'sv',FI:'fi sv',IS:'is',EE:'et',LV:'lv',LT:'lt',HU:'hu',RO:'ro',MD:'ro',HR:'hr',SI:'sl',BA:'bs',RS:'sr',ME:'sr',AL:'sq',TR:'tr',AZ:'az',ID:'id',MY:'ms',VN:'vi',PH:'tl',UA:'uk',JP:'ja',CN:'zh',TW:'zh',HK:'zh',KR:'ko'};
exports.normalize = function (value) {
  if (typeof value !== 'string') return '';
  var text=value.replace(/[\uff01-\uff5e]/g,function (c) {return String.fromCharCode(c.charCodeAt(0)-0xfee0);})
    .replace(/[、،]/g,',').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,80)
    .replace(/\s*,\s*/g,', ');
  return text.replace(/, ([a-z]{2,3})$/i,function (_,country) {
    country=country.toUpperCase();return ', '+(COUNTRY_ALIASES[country] || country);
  });
};
exports.parse = function (value) {
  var parts=exports.normalize(value).split(', ');
  if(parts.length<2 || parts.length>3 || !/^[A-Z]{2}$/.test(parts[parts.length-1]) || parts[0].length<2 || (parts.length===3 && !parts[1]))return null;
  var place={city:parts[0],country:parts[parts.length-1]};
  if(parts.length===3)place.region=parts[1];
  return place;
};
function scriptLanguage(name,country) {
  if(/[\u3040-\u30ff]/.test(name))return 'ja';
  if(/[\u3400-\u9fff]/.test(name))return country==='JP'?'ja':'zh';
  if(/[\u0400-\u052f]/.test(name))return /[іїєґІЇЄҐ]/.test(name)?'uk':
    ({UA:'uk',BG:'bg',BY:'be',RS:'sr',MK:'mk',KZ:'kk',MN:'mn'}[country] || 'ru');
  if(/[\uac00-\ud7af\u1100-\u11ff]/.test(name))return 'ko';
  if(/[\u0370-\u03ff\u1f00-\u1fff]/.test(name))return 'el';
  if(/[\u0590-\u05ff]/.test(name))return 'he';
  if(/[\u0600-\u06ff]/.test(name))return ({IR:'fa',AF:'fa',PK:'ur'}[country] || 'ar');
  var scripts=[[/[\u0900-\u097f]/,country==='NP'?'ne':'hi'],[/[\u0980-\u09ff]/,'bn'],[/[\u0a00-\u0a7f]/,'pa'],[/[\u0a80-\u0aff]/,'gu'],[/[\u0b00-\u0b7f]/,'or'],[/[\u0b80-\u0bff]/,'ta'],[/[\u0c00-\u0c7f]/,'te'],[/[\u0c80-\u0cff]/,'kn'],[/[\u0d00-\u0d7f]/,'ml'],[/[\u0d80-\u0dff]/,'si'],[/[\u0e00-\u0e7f]/,'th'],[/[\u0e80-\u0eff]/,'lo'],[/[\u1000-\u109f]/,'my'],[/[\u10a0-\u10ff\u1c90-\u1cbf]/,'ka'],[/[\u0530-\u058f]/,'hy'],[/[\u1780-\u17ff]/,'km'],[/[\u1200-\u137f]/,'am']];
  for(var i=0;i<scripts.length;i++)if(scripts[i][0].test(name))return scripts[i][1];
  return '';
}
exports.searches = function (place,locale) {
  var name=place.city,script=scriptLanguage(name,place.country),queries=[];
  var languages=script?[script]:(LOCAL_LANGUAGES[place.country] || 'en').split(' ');
  var phoneLanguage=typeof locale==='string'?locale.toLowerCase().split(/[-_]/)[0]:'';
  // Prefer local names before English prefix matches (Wien, Firenze, etc.).
  if(/^[a-z]{2}$/.test(phoneLanguage))languages.push(phoneLanguage);
  if(/[\u0400-\u052f]/.test(name))languages.push('ru');
  languages.push('en');
  function add(n,language) {
    n+=place.region?', '+place.region:'';
    for(var i=0;i<queries.length;i++)if(queries[i].name===n && queries[i].language===language)return;
    if(queries.length<4)queries.push({name:n,language:language});
  }
  if(place.country==='US' && /^nyc$/i.test(name))name='New York';
  if(place.country==='TW')name=name.replace(/臺/g,'台');
  // Short East Asian names are indexed with administrative suffixes. Try those
  // first so a small namesake does not beat the intended city (notably Busan).
  if(place.country==='JP' && /^[\u3400-\u9fff]{2}$/.test(name))add(name+(name==='東京'?'都':'市'),'ja');
  if(place.country==='TW' && /^[\u3400-\u9fff]{2}$/.test(name))add(name+'市','zh');
  if(place.country==='KR' && /^[\uac00-\ud7af]{2}$/.test(name)) {
    add(name+'특별시','ko');add(name+'광역시','ko');add(name+'시','ko');
  }
  // Standard German keyboard transliteration, without changing the saved input.
  if((place.country==='DE'||place.country==='AT'||place.country==='CH') && /[aou]e/i.test(name))
    add(name.replace(/ae/gi,'ä').replace(/oe/gi,'ö').replace(/ue/gi,'ü'),'de');
  for(var i=0;i<languages.length;i++)add(name,languages[i]);
  return queries;
};
function matchKey(name,country) {
  var text=name.toLowerCase().replace(/[’‘]/g,"'");
  // Pebble's JS engine lacks String.normalize. Keep comparison ES5-compatible.
  var groups={'a':'àáâãäåāăą','c':'çćĉċč','d':'ďđ','e':'èéêëēĕėęě','g':'ĝğġģ','h':'ĥħ','i':'ìíîïĩīĭįı','j':'ĵ','k':'ķ','l':'ĺļľŀł','n':'ñńņň','o':'òóôõöøōŏő','r':'ŕŗř','s':'śŝşš','t':'ţťŧ','u':'ùúûüũūŭůűų','w':'ŵ','y':'ýÿŷ','z':'źżž'};
  for(var key in groups)text=text.replace(new RegExp('['+groups[key]+']','g'),key);
  text=text.replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss');
  if(country==='JP')text=text.replace(/[市都]$/,'');
  if(country==='KR')text=text.replace(/(특별자치시|특별시|광역시|시)$/,'');
  if(country==='TW')text=text.replace(/臺/g,'台').replace(/市$/,'');
  return text;
}
exports.candidates = function (results,place) {
  if(!Array.isArray(results))return [];
  return results.filter(function (r) {return r && r.country_code===place.country && /^PPL/.test(r.feature_code || '') && typeof r.name==='string' && r.name.length>0 &&
    typeof r.id==='number' && r.id>0 && Math.floor(r.id)===r.id && typeof r.latitude==='number' && typeof r.longitude==='number' &&
    isFinite(r.latitude) && isFinite(r.longitude) && Math.abs(r.latitude)<=90 && Math.abs(r.longitude)<=180;});
};
exports.matches = function (results,place,query) {
  var expected=matchKey(query.name.split(',')[0].trim(),place.country),seen={};
  return exports.candidates(results,place).filter(function(r){
    if(seen[r.id] || matchKey(r.name,place.country)!==expected)return false;
    seen[r.id]=true;return true;
  });
};
exports.find = function (results,place,query) {
  var matches=exports.matches(results,place,query);
  return matches.length===1?matches[0]:null;
};
exports.selection = function (values) {
  try {
    var raw=values.WEATHER_PLACE;
    if(typeof raw!=='string' || raw.length>1024)return null;
    var selected=JSON.parse(raw),place=exports.parse(values.WEATHER_CITY);
    if(!place || selected.input!==exports.normalize(values.WEATHER_CITY) || !exports.candidates([selected],place).length)return null;
    return selected;
  }catch(e){return null;}
};
exports.encodeSelection = function (result,input) {
  var place=exports.parse(input);
  if(!place || !exports.candidates([result],place).length)return '';
  return JSON.stringify({input:exports.normalize(input),id:result.id,name:result.name.slice(0,100),
    admin1:typeof result.admin1==='string'?result.admin1.slice(0,100):'',admin2:typeof result.admin2==='string'?result.admin2.slice(0,100):'',
    country:typeof result.country==='string'?result.country.slice(0,80):result.country_code,country_code:result.country_code,feature_code:result.feature_code,
    latitude:Number(result.latitude.toFixed(2)),longitude:Number(result.longitude.toFixed(2))});
};
exports.scope = function (values) {
  // Refresh pre-1.6 lookups once: old caches may contain a prefix-only match.
  if(!values.WEATHER_SOURCE)return 'phone';
  var selected=exports.selection(values);
  return selected?'place:'+selected.id+':'+selected.latitude.toFixed(2)+','+selected.longitude.toFixed(2):'city:v2:'+exports.normalize(values.WEATHER_CITY).toLowerCase();
};
exports.id = function (scope) {
  if(scope==='phone')return 0;
  var hash=5381;
  for(var i=0;i<scope.length;i++)hash=((hash*33)^scope.charCodeAt(i))|0;
  return (hash&0x7fffffff)||1;
};

return exports;
}
module.exports=createLocation();
// Clay serializes this self-contained factory for the settings page.
module.exports.create=createLocation;
