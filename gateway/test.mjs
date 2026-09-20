import http from "node:http";
import {spawn} from "node:child_process";
const port=Number(process.env.GATEWAY_TEST_PORT||randomPort());
function randomPort(){return 18080+Math.floor(Math.random()*500);}
const child=spawn(process.execPath,["gateway/server.mjs"],{env:{...process.env,PORT:String(port),HOST:"127.0.0.1"},stdio:["ignore","pipe","pipe"]});
let output="";
child.stdout.on("data",x=>{output+=x.toString();});
child.stderr.on("data",x=>{output+=x.toString();});
function request(pathname){
  return new Promise((resolve,reject)=>{
    const req=http.get({hostname:"127.0.0.1",port,path:pathname},res=>{
      let data="";
      res.setEncoding("utf8");
      res.on("data",x=>data+=x);
      res.on("end",()=>resolve({status:res.statusCode,headers:res.headers,body:data}));
    });
    req.on("error",reject);
  });
}
async function waitForServer(){
  for(let attempt=0;attempt<40;attempt++){
    try{return await request("/api/health");}
    catch{await new Promise(r=>setTimeout(r,75));}
  }
  throw new Error("Gateway did not start. "+output);
}
try{
  const health=await waitForServer();
  if(health.status!==200)throw new Error("Health endpoint returned "+health.status);
  const json=JSON.parse(health.body);
  if(json.ok!==true||json.service!=="nexovonarsa-corporate-gateway")throw new Error("Health payload is invalid");
  const version=await request("/api/version");
  if(version.status!==200||!JSON.parse(version.body).version)throw new Error("Version endpoint is invalid");
  const site=await request("/");
  if(site.status!==200||!site.body.includes("NEXOVONARSA CORPORATION"))throw new Error("Static index did not load");
  if(site.headers["x-content-type-options"]!=="nosniff")throw new Error("Security header missing");
  const missing=await request("/does-not-exist");
  if(missing.status!==404)throw new Error("404 route returned "+missing.status);
  const traversal=await request("/%2e%2e/package.json");
  if(traversal.status===200)throw new Error("Path traversal protection failed");
  console.log("Gateway smoke test passed.");
}finally{
  child.kill("SIGTERM");
}
