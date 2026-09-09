const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const INDEX = path.join(ROOT, 'TECH_SOURCE_RRB_Result_Analyzer_FINAL.html');
const MAX_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 20000;
const ALLOWED_HOST = h => h === 'digialm.com' || h.endsWith('.digialm.com');

const hits = new Map();
function rateLimit(ip){
  const now=Date.now(), arr=(hits.get(ip)||[]).filter(t=>now-t<60000); 
  if(arr.length>=30){hits.set(ip,arr);return false;}
  arr.push(now);hits.set(ip,arr);return true;
}
function send(res,status,type,body,extra={}){
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});
  res.end(body);
}
async function fetchDigialm(target,depth=0){
  if(depth>4) throw new Error('Too many redirects');
  const u=new URL(target);
  if(!['http:','https:'].includes(u.protocol)) throw new Error('Only HTTP/HTTPS URLs are allowed');
  if(!ALLOWED_HOST(u.hostname.toLowerCase())) throw new Error('Only Digialm domains are allowed');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const r=await fetch(u,{redirect:'manual',signal:controller.signal,headers:{'User-Agent':'TECH-SOURCE-RRB-Analyzer/1.0','Accept':'text/html,application/xhtml+xml,text/plain,multipart/related,*/*'}});
    if([301,302,303,307,308].includes(r.status)){
      const loc=r.headers.get('location');
      if(!loc) throw new Error('Redirect without location');
      return fetchDigialm(new URL(loc,u).toString(),depth+1);
    }
    if(!r.ok) throw new Error(`Source HTTP ${r.status}`);
    const len=Number(r.headers.get('content-length')||0);
    if(len>MAX_BYTES) throw new Error('Response sheet is too large');
    const buf=Buffer.from(await r.arrayBuffer());
    if(buf.length>MAX_BYTES) throw new Error('Response sheet is too large');
    const text=buf.toString('utf8');
    if(text.length<200) throw new Error('Empty/invalid response sheet');
    return text;
  }finally{clearTimeout(timer)}
}
const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(req.method==='GET' && u.pathname==='/api/health') return send(res,200,'application/json; charset=utf-8',JSON.stringify({ok:true,service:'TECH SOURCE RRB URL backend'}));
    if(req.method==='GET' && u.pathname==='/api/fetch'){
      const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
      if(!rateLimit(ip)) return send(res,429,'application/json; charset=utf-8',JSON.stringify({error:'Rate limit exceeded'}));
      const target=u.searchParams.get('url');
      if(!target) return send(res,400,'application/json; charset=utf-8',JSON.stringify({error:'Missing url parameter'}));
      try{
        const text=await fetchDigialm(target);
        return send(res,200,'text/plain; charset=utf-8',text,{'Access-Control-Allow-Origin':'*'});
      }catch(e){return send(res,502,'application/json; charset=utf-8',JSON.stringify({error:e.message||'Fetch failed'}),{'Access-Control-Allow-Origin':'*'});}
    }
    if(req.method==='GET' && (u.pathname==='/' || u.pathname==='/index.html')){
      if(!fs.existsSync(INDEX)) return send(res,404,'text/plain; charset=utf-8','HTML file not found');
      return send(res,200,'text/html; charset=utf-8',fs.readFileSync(INDEX));
    }
    send(res,404,'text/plain; charset=utf-8','Not found');
  }catch(e){send(res,500,'text/plain; charset=utf-8','Server error')}
});
server.listen(PORT,()=>console.log(`TECH SOURCE RRB Analyzer: http://localhost:${PORT}`));
