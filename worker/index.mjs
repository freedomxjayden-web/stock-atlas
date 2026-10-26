import {normalizeSymbol,assembleStock,FUND_TYPES} from '../shared/analysis.mjs';
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'};
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
export async function providerJson(url,kind,env,ctx,fetcher=fetch) {
  const cache=globalThis.caches?.default;
  const key=new Request(url);
  const cached=cache?await cache.match(key):null;
  if(cached){const data=await cached.json();return {...data,cached:true};}
  const response=await fetcher(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'},signal:AbortSignal.timeout(14000)});
  if(!response.ok)throw new ApiError(response.status===404?404:response.status===429?429:502,response.status===404?'找不到這個股票代號。':response.status===429?'資料來源暫時限流，請稍後重試。':'資料來源暫時未能回應，請稍後重試。');
  const payload=await response.json();
  const envelope={payload,fetchedAt:new Date().toISOString(),cached:false};
  if(cache){const stored=new Response(JSON.stringify(envelope),{headers:{'Content-Type':'application/json','Cache-Control':`public, max-age=${kind==='chart'?300:86400}`}});ctx.waitUntil(cache.put(key,stored).catch(()=>{}));}
  return envelope;
}
export async function handle(request,env={},ctx={waitUntil:p=>p},fetcher=fetch){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  const allowed=(env.ALLOWED_ORIGINS??'http://localhost:8787,http://127.0.0.1:8787').split(',').map(x=>x.trim());
  const cors=origin&&allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Max-Age':'86400','Vary':'Origin'}:{};
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...cors,...(status===429?{'Retry-After':'60'}:{})}});
  if(origin&&!allowed.includes(origin))return json({error:'此網站來源未獲授權。'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='GET')return json({error:'只支援 GET 查詢。'},405);
  if(url.pathname==='/api/health')return json({status:'ok',service:'stock-atlas',version:1});
  if(url.pathname!=='/api/stock')return json({error:'找不到此端點。'},404);
  try{
    let symbol;try{symbol=normalizeSymbol(url.searchParams.get('symbol')??'');}catch(e){throw new ApiError(400,e.message);}
    if(env.RATE_LIMITER){const {success}=await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')??'local'});if(!success)throw new ApiError(429,'查詢太頻密，請一分鐘後再試。');}
    const code=encodeURIComponent(symbol),now=Date.now(),end=Math.floor(now/1000),start=end-5*366*86400;
    // Dates use day boundaries so the financial cache key stays stable all day.
    const period2=Math.ceil(end/86400)*86400,period1=Math.floor(start/86400)*86400;
    const chartUrl=`https://query1.finance.yahoo.com/v8/finance/chart/${code}?range=2y&interval=1d&events=div%2Csplits`;
    const finUrl=`https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${code}?type=${FUND_TYPES.join(',')}&period1=${period1}&period2=${period2}`;
    const [chart,fin]=await Promise.allSettled([providerJson(chartUrl,'chart',env,ctx,fetcher),providerJson(finUrl,'financials',env,ctx,fetcher)]);
    if(chart.status==='rejected')throw chart.reason;
    const result=assembleStock(chart.value.payload,fin.status==='fulfilled'?fin.value.payload:null,symbol,now);
    if(fin.status==='rejected')result.fundamentals.missing.push('財務資料服務暫時無法連線；價格與技術分析仍可使用。');
    result.cache={price:{cached:chart.value.cached,fetchedAt:chart.value.fetchedAt,ttl:300},financials:fin.status==='fulfilled'?{cached:fin.value.cached,fetchedAt:fin.value.fetchedAt,ttl:86400}:null};
    return json(result);
  }catch(e){return json({error:e.name==='TimeoutError'?'資料來源連線逾時，請重試。':e.message||'暫時無法分析。'},e.status??502);}
}
export default {fetch:handle};
