import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const HOST=process.env.HOST||"127.0.0.1";
const PORT=Math.max(1,Number(process.env.PORT||8080));
const MIME=Object.freeze({
  ".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8",".svg":"image/svg+xml",
  ".txt":"text/plain; charset=utf-8",".md":"text/markdown; charset=utf-8"
});
const securityHeaders={
  "x-content-type-options":"nosniff",
  "x-frame-options":"DENY",
  "referrer-policy":"strict-origin-when-cross-origin",
  "permissions-policy":"camera=(), microphone=(), geolocation=()",
  "content-security-policy":"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://github.com; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://*.supabase.co"
};
function send(res,status,body,headers={}){
  res.writeHead(status,{...securityHeaders,"cache-control":"no-store",...headers});
  res.end(body);
}
function safePath(requestPath){
  let decoded;
  try{decoded=decodeURIComponent(requestPath.split("?")[0]||"/");}catch{return null}
  const relative=decoded.replace(/^\/+/,"")||"index.html";
  if(relative.includes("\0"))return null;
  const absolute=path.resolve(ROOT,relative);
  if(absolute!==ROOT&&!absolute.startsWith(ROOT+path.sep))return null;
  return absolute;
}
async function serveStatic(req,res,requestPath){
  let file=safePath(requestPath);
  if(!file)return send(res,400,"Bad Request\n",{"content-type":"text/plain; charset=utf-8"});
  try{
    const stat=await fs.stat(file);
    if(stat.isDirectory())file=path.join(file,"index.html");
    const body=await fs.readFile(file);
    const type=MIME[path.extname(file).toLowerCase()]||"application/octet-stream";
    const payload=req.method==="HEAD"?null:body;
    send(res,200,payload,{"content-type":type,"cache-control":type.includes("html")?"no-store":"public, max-age=300"});
  }catch(error){
    if(error.code==="ENOENT")return send(res,404,"Not Found\n",{"content-type":"text/plain; charset=utf-8"});
    return send(res,500,"Internal Server Error\n",{"content-type":"text/plain; charset=utf-8"});
  }
}
const server=http.createServer(async(req,res)=>{
  try{
    if(req.method!=="GET"&&req.method!=="HEAD")return send(res,405,"Method Not Allowed\n",{"allow":"GET, HEAD","content-type":"text/plain; charset=utf-8"});
    const url=new URL(req.url||"/","http://"+(req.headers.host||"localhost"));
    if(url.pathname==="/api/health"){
      const body=JSON.stringify({ok:true,service:"nexovonarsa-corporate-gateway",version:"5.3.0",timestamp:new Date().toISOString()});
      return send(res,200,req.method==="HEAD"?null:body,{"content-type":"application/json; charset=utf-8"});
    }
    if(url.pathname==="/api/version"){
      const body=JSON.stringify({name:"NEXOVONARSA CORPORATION",version:"5.3.0"});
      return send(res,200,req.method==="HEAD"?null:body,{"content-type":"application/json; charset=utf-8"});
    }
    return serveStatic(req,res,url.pathname);
  }catch(error){
    return send(res,500,"Gateway error: "+String(error?.message||error)+"\n",{"content-type":"text/plain; charset=utf-8"});
  }
});
server.listen(PORT,HOST,()=>console.log("NEXOVONARSA gateway listening on http://"+HOST+":"+PORT));
process.on("SIGINT",()=>server.close(()=>process.exit(0)));
process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
