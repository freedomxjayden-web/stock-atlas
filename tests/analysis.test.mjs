import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSymbol,ema,rsi,technical,fundamentals,score,parseChart,assembleStock} from '../shared/analysis.mjs';
import {handle} from '../worker/index.mjs';
const bars=(n=250,fn=i=>100+i)=>Array.from({length:n},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),close:fn(i),adjustedClose:fn(i),volume:100,complete:true}));
const now=Date.parse('2026-10-26T12:30:00Z');
function finance({date='2025-12-31',previous='2024-12-31',currency='USD',override={}}={}){
 const values={annualTotalRevenue:[100,125],annualNetIncome:[10,20],annualBasicEPS:[1,2],annualOperatingCashFlow:[15,30],annualFreeCashFlow:[5,10],...override};
 return {timeseries:{result:Object.entries(values).map(([type,vals])=>({meta:{type:[type]},[type]:vals.map((value,i)=>({asOfDate:i?date:previous,periodType:'12M',currencyCode:currency,reportedValue:{raw:value}}))}))}};
}
function chart(symbol='AAPL'){
 const b=bars();return {chart:{result:[{meta:{symbol,instrumentType:'EQUITY',currency:'USD',regularMarketPrice:349,regularMarketTime:Date.parse(b.at(-1).date+'T20:00:00Z')/1000,exchangeTimezoneName:'America/New_York'},timestamp:b.map(b=>Date.parse(b.date+'T16:00:00Z')/1000),indicators:{quote:[{close:b.map(b=>b.close),volume:b.map(b=>b.volume)}],adjclose:[{adjclose:b.map(b=>b.adjustedClose)}]}}]}};
}
test('Normalize HK and US share-class codes; reject URLs and malformed symbols',()=>{
 for(const [input,out] of [['700','0700.HK'],['0700.hk','0700.HK'],['9988','9988.HK'],[' aapl ','AAPL'],['brk.b','BRK-B'],['NVDA','NVDA']])assert.equal(normalizeSymbol(input),out);
 for(const s of ['','0','0.HK','<script>','AAPL?x=1','https://host','123456','../AAPL','AAPL&url=x'])assert.throws(()=>normalizeSymbol(s));
});
test('SMA, seeded EMA, RSI and volume ratio have known reference values',()=>{
 const t=technical(bars());assert.equal(t.ma20,339.5);assert.equal(t.ma50,324.5);assert.equal(t.ma200,249.5);assert.equal(t.rsi14,100);assert.equal(t.volumeRatio,1);assert.equal(t.maxDrawdown,0);
 assert.deepEqual(ema([1,2,3,4,5],3),[null,null,2,3,4]);assert.equal(rsi(Array(20).fill(10)),50);assert.equal(rsi(Array.from({length:20},(_,i)=>30-i)),0);
 assert.ok(Math.abs(t.macd-7)<.00001);assert.ok(Math.abs(t.signal-7)<.00001);
 const variance=Array.from({length:20},(_,i)=>(i-9.5)**2).reduce((a,b)=>a+b)/20;
 assert.ok(Math.abs(t.bollingerUpper-(339.5+2*Math.sqrt(variance)))<.00001);
});
test('RSI uses Wilder reference sequence, not plain trailing averages',()=>{
 const sequence=[44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46.00];
 assert.ok(Math.abs(rsi(sequence)-66.24961855355505)<1e-9);
});
test('Insufficient history produces null, not fabricated zeros',()=>{const t=technical(bars(10));assert.equal(t.ma20,null);assert.equal(t.ma200,null);assert.equal(t.rsi14,null);assert.equal(t.signal,null);assert.equal(t.annualVolatility,null);assert.equal(t.volumeRatio,null);assert.equal(technical([]).price,null);});
test('Max drawdown and sample annual volatility are independent of price scale',()=>{
 const a=technical(bars(100,i=>100+(i%8)*5)),b=technical(bars(100,i=>(100+(i%8)*5)*10));
 assert.ok(Math.abs(a.maxDrawdown+25.925926)<1e-5);assert.equal(a.annualVolatility,b.annualVolatility);
 const t=technical(bars(61,i=>100*Math.exp(i*.01)));assert.ok(t.annualVolatility<.000001);
});
test('Financials align annual dates and currencies, and calculate growth/margins',()=>{
 const f=fundamentals(finance({currency:'CNY'}),now);assert.equal(f.revenueGrowth,25);assert.equal(f.netMargin,16);assert.equal(f.previousNetMargin,10);assert.equal(f.currency,'CNY');assert.equal(f.stale,false);assert.equal(f.valuation.pe,null);
 const payload=finance();payload.timeseries.result.find(r=>r.meta.type[0]==='annualBasicEPS').annualBasicEPS.at(-1).currencyCode='HKD';assert.equal(fundamentals(payload,now).eps,null);
 assert.equal(fundamentals(finance({override:{annualTotalRevenue:[0,125]}}),now).revenueGrowth,null);
});
test('Old reports are excluded from scoring, and future/quarterly reports ignored',()=>{
 const old=fundamentals(finance({date:'2022-12-31',previous:'2021-12-31'}),now);assert.equal(old.stale,true);assert.equal(score(technical(bars()),old).coverage,40);assert.equal(score(technical(bars()),old).total,null);
 assert.equal(fundamentals(finance({date:'2030-12-31',previous:'2029-12-31'}),now).available,false);
 const p=finance();p.timeseries.result.forEach(s=>s[s.meta.type[0]].forEach(x=>x.periodType='3M'));assert.equal(fundamentals(p,now).available,false);
});
test('Scoring uses exact thresholds; missing weights are excluded',()=>{
 const t={price:110,ma20:105,ma50:100,ma200:90,macd:2,signal:1,return20:5};
 const f={available:true,stale:false,revenueGrowth:20,netIncome:20,netMargin:20,previousNetMargin:10,operatingCashFlow:30,freeCashFlow:15};
 assert.equal(score(t,f).total,100);
 for(const [g,points] of [[20,20],[19.99,15],[10,15],[9.99,10],[.01,10],[0,0],[-5,0]])assert.equal(score(t,{...f,revenueGrowth:g}).items.find(x=>x.group==='營收增長').points,points);
 const partial=score(t,{...f,operatingCashFlow:null,freeCashFlow:null});assert.equal(partial.coverage,80);assert.equal(partial.total,100);
 const techOnly=score(t,{available:false});assert.equal(techOnly.coverage,40);assert.equal(techOnly.total,null);
 const onlyOne=score(t,{available:true,netIncome:1});assert.equal(onlyOne.coverage,50);assert.equal(onlyOne.total,null);
 const zero=score({...t,price:1,ma20:2,ma50:3,ma200:4,macd:-2,signal:-1,return20:-1},{...f,revenueGrowth:-1,netIncome:-1,netMargin:-2,previousNetMargin:1,operatingCashFlow:-1,freeCashFlow:-1});assert.equal(zero.total,0);
});
test('Current incomplete HK session excluded; closed session included',()=>{
 const p=chart('0700.HK'),r=p.chart.result[0];r.meta.exchangeTimezoneName='Asia/Hong_Kong';r.meta.currentTradingPeriod={regular:{end:Date.parse('2026-10-26T08:00:00Z')/1000}};
 r.timestamp=[Date.parse('2026-10-23T01:30Z')/1000,Date.parse('2026-10-26T01:30Z')/1000];r.indicators={quote:[{close:[100,200],volume:[100,100]}],adjclose:[{adjclose:[100,200]}]};
 const open=parseChart(p,'0700.HK',Date.parse('2026-10-26T06:00Z'));assert.equal(open.technical.observations,1);assert.equal(open.bars[1].complete,false);
 const closed=parseChart(p,'0700.HK',Date.parse('2026-10-26T09:00Z'));assert.equal(closed.technical.observations,2);
});
test('US daylight-saving timezone and missing close-time are handled conservatively',()=>{
 const p=chart(),r=p.chart.result[0];r.timestamp=[Date.parse('2026-10-26T13:30Z')/1000];r.indicators={quote:[{close:[100],volume:[1]}],adjclose:[{adjclose:[100]}]};
 assert.equal(parseChart(p,'AAPL',Date.parse('2026-10-26T18:00Z')).technical.observations,0);
 assert.equal(parseChart(p,'AAPL',Date.parse('2026-10-27T05:00Z')).technical.observations,1);
});
test('API validates method, origin, symbol and rate limit before upstream access',async()=>{
 const env={ALLOWED_ORIGINS:'https://example.github.io'},ctx={waitUntil:()=>{}},noFetch=()=>{throw new Error('upstream should not run');};
 assert.equal((await handle(new Request('https://api.test/api/stock?symbol=700',{headers:{Origin:'https://evil.test'}}),env,ctx,noFetch)).status,403);
 assert.equal((await handle(new Request('https://api.test/api/stock?symbol=%3Cscript%3E'),env,ctx,noFetch)).status,400);
 assert.equal((await handle(new Request('https://api.test/api/stock?symbol=700',{method:'POST'}),env,ctx,noFetch)).status,405);
 const limited={...env,RATE_LIMITER:{limit:async()=>({success:false})}};assert.equal((await handle(new Request('https://api.test/api/stock?symbol=700'),limited,ctx,noFetch)).status,429);
 const cors=await handle(new Request('https://api.test/api/health',{headers:{Origin:'https://example.github.io'}}),env,ctx,noFetch);assert.equal(cors.headers.get('Access-Control-Allow-Origin'),'https://example.github.io');
});
test('Upstream failures retain technical analysis when financials unavailable',async()=>{
 const mock=async url=>url.includes('/chart/')?Response.json(chart()):new Response('unavailable',{status:503});
 const response=await handle(new Request('https://api.test/api/stock?symbol=AAPL'),{}, {waitUntil:()=>{}},mock);assert.equal(response.status,200);const d=await response.json();assert.equal(d.fundamentals.available,false);assert.equal(d.score.total,null);assert.equal(d.technical.ma20,339.5);
 const fail=await handle(new Request('https://api.test/api/stock?symbol=AAPL'),{}, {waitUntil:()=>{}},async()=>new Response('limited',{status:429}));assert.equal(fail.status,429);
});
test('Complete assembly retains quote currency separately from financial currency',()=>{const d=assembleStock(chart(),finance({currency:'CNY'}),'AAPL',now);assert.equal(d.currency,'USD');assert.equal(d.fundamentals.currency,'CNY');assert.equal(d.score.coverage,100);assert.equal(d.fundamentals.valuation.pe,null);});
test('Provider HTTP-200 errors are not treated as successful data or cached',async()=>{
 const response=await handle(new Request('https://api.test/api/stock?symbol=ZZZZZ'),{}, {waitUntil:()=>{}},async()=>Response.json({chart:{result:null,error:{code:'Not Found',description:'Unknown symbol'}}}));assert.equal(response.status,404);
 const p=chart();p.chart.result[0].meta.instrumentType='ETF';assert.throws(()=>parseChart(p,'SPY',now),e=>e.status===400);
});
