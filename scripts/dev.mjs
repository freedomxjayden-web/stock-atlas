import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {handle} from '../worker/index.mjs';
const run=promisify(execFile),root=fileURLToPath(new URL('../site/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const cached=new Map();
// Local adapter uses system curl for OS trust-store support; production uses Workers fetch.
async function upstream(url){
 const hit=cached.get(url);if(hit&&Date.now()-hit.time<(url.includes('/chart/')?300000:86400000))return new Response(hit.data,{headers:{'Content-Type':'application/json'}});
 const {stdout}=await run('curl',['--silent','--show-error','--fail-with-body','--max-time','18','--user-agent','Mozilla/5.0',url],{maxBuffer:8*1024*1024}).catch(e=>{throw new Error('資料來源無法連線，請稍後重試。');});
 cached.set(url,{time:Date.now(),data:stdout});return new Response(stdout,{headers:{'Content-Type':'application/json'}});
}
const port=Number(process.env.PORT??8787);
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://localhost:${port}`);
  if(url.pathname.startsWith('/api/')){
   const response=await handle(new Request(url,{method:req.method,headers:req.headers}),{ALLOWED_ORIGINS:`http://localhost:${port},http://127.0.0.1:${port}`},{waitUntil:p=>p},upstream);
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!path.startsWith(root)||!types[extname(path)]){res.writeHead(404);res.end('Not found');return;}
  const data=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)],'Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Stock Atlas: http://localhost:${port}`));
