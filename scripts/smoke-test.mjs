import fs from "node:fs/promises";
import vm from "node:vm";

const source = {
  data: await fs.readFile("data.js", "utf8"),
  portfolio: await fs.readFile("portfolio.js", "utf8"),
  github: await fs.readFile("github-live.js", "utf8"),
  external: await fs.readFile("external-live.js", "utf8"),
  i18n: await fs.readFile("i18n.js", "utf8"),
  app: await fs.readFile("app.js", "utf8")
};

class MockClassList {
  constructor(){ this.values=new Set(); }
  add(){ for(const value of arguments)this.values.add(value); }
  remove(){ for(const value of arguments)this.values.delete(value); }
  toggle(value,force){ const next=force===undefined?!this.values.has(value):!!force; next?this.values.add(value):this.values.delete(value); return next; }
  contains(value){ return this.values.has(value); }
}

class MockElement {
  constructor(id){
    this.id=id;
    this.innerHTML="";
    this.textContent="";
    this.value="";
    this.dataset={};
    this.onclick=null;
    this.oninput=null;
    this.onchange=null;
    this.classList=new MockClassList();
    this.style={};
  }
  focus(){}
  setSelectionRange(){}
  setAttribute(){}
  removeAttribute(){}
}

const elements=new Map();
function getElement(id){
  if(!elements.has(id))elements.set(id,new MockElement(id));
  return elements.get(id);
}

const document={
  getElementById:getElement,
  querySelectorAll:function(){return[];},
  querySelector:function(){return null;},
  createElement:function(tag){return new MockElement(tag);},
  addEventListener:function(){},
  visibilityState:"visible"
};

const localStorage={
  data:new Map(),
  getItem(key){return this.data.has(key)?this.data.get(key):null;},
  setItem(key,value){this.data.set(key,String(value));},
  removeItem(key){this.data.delete(key);}
};

const window={
  localStorage,
  document,
  NX_I18N:{id:{label:"Indonesia",dir:"ltr",nav:{},common:{} }},
  NX_LANG:"id",
  NX_T:function(key){return key;},
  NX_CONFIG:{app:{defaultLanguage:"id",supportedLanguages:["id","en","ms","vi","th","zh","ja","ko","ar","es"]}},
  NX_AUTH:{getUser:function(){return null},isConfigured:function(){return false}},
  NX_EXPERIENCE:{afterRender:function(){},start:function(){}},
  location:{origin:"https://example.invalid",pathname:"/"},
  isSecureContext:false,
  GITHUB_LIVE_DATA:{records:[]},
  SCRAPE_LIVE_DATA:{sources:[]}
};

const context={window,document,localStorage,console,URL,Blob,Date,Math,Number,String,Object,Array,Set,Map,JSON,RegExp};
vm.createContext(context);

function run(path){
  vm.runInContext(source[path],context,{filename:path});
}

run("data");
run("portfolio");
run("github");
run("external");
run("i18n");
context.window.NX_T=function(key){return key;};
run("app");

if(!Array.isArray(context.window.CORPORATE_DATA?.projects))throw new Error("Corporate data failed to bootstrap.");
if(!Array.isArray(context.window.GITHUB_LIVE_DATA?.records))throw new Error("GitHub snapshot failed to bootstrap.");
if(!Array.isArray(context.window.SCRAPE_LIVE_DATA?.sources))throw new Error("Scraper snapshot failed to bootstrap.");

const routes=vm.runInContext("N.slice()",context);
const failures=[];
for(const route of routes){
  vm.runInContext("P.page="+JSON.stringify(route)+";render()",context);
  const html=elements.get("page")?.innerHTML||"";
  if(!html)failures.push(route+": empty render");
  if(/System Error/.test(html))failures.push(route+": renderer error");
}

if(failures.length){
  console.error("Smoke test failures:");
  failures.forEach(function(x){console.error(" - "+x);});
  process.exit(1);
}
console.log("Browser smoke test passed: "+routes.length+" routes rendered successfully.");
