export const finite = v => typeof v === 'number' && Number.isFinite(v);
const mean = a => a.reduce((x,y)=>x+y,0)/a.length;
const round = v => finite(v) ? Math.round(v*1e6)/1e6 : null;
const names = {'0700.HK':'騰訊控股','9988.HK':'阿里巴巴','0005.HK':'滙豐控股','3690.HK':'美團','1810.HK':'小米集團','0941.HK':'中國移動','0388.HK':'香港交易所','AAPL':'Apple','NVDA':'NVIDIA','MSFT':'Microsoft','TSLA':'Tesla','GOOGL':'Alphabet','AMZN':'Amazon','META':'Meta Platforms'};
export function normalizeSymbol(input='') {
  const s=String(input).trim().toUpperCase();
  if (/^\d{1,5}(\.HK)?$/.test(s)) {
    const n=Number(s.split('.')[0]);
    if(n>0) return `${String(n).padStart(4,'0')}.HK`;
  }
  if(/^[A-Z]{1,6}([.-][A-Z])?$/.test(s)) return s.replace(/\.([A-Z])$/,'-$1');
  throw new Error('請輸入港股編號（700、9988）或美股代號（AAPL、NVDA）。');
}
export function ema(values,n) {
  const out=Array(values.length).fill(null);
  if(values.length<n)return out;
  out[n-1]=mean(values.slice(0,n)); const a=2/(n+1);
  for(let i=n;i<values.length;i++)out[i]=a*values[i]+(1-a)*out[i-1];
  return out;
}
export function rsi(values,n=14) {
  if(values.length<=n)return null;
  const d=values.slice(1).map((v,i)=>v-values[i]);
  let gain=mean(d.slice(0,n).map(v=>Math.max(v,0))),loss=mean(d.slice(0,n).map(v=>Math.max(-v,0)));
  for(const v of d.slice(n)){gain=(gain*(n-1)+Math.max(v,0))/n;loss=(loss*(n-1)+Math.max(-v,0))/n;}
  return loss===0 ? (gain===0?50:100) : 100-100/(1+gain/loss);
}
export function technical(bars) {
  const v=bars.map(b=>b.adjustedClose),last=v.at(-1),sma=n=>v.length>=n?mean(v.slice(-n)):null;
  const f=ema(v,12),s=ema(v,26),diff=f.map((x,i)=>finite(x)&&finite(s[i])?x-s[i]:null).filter(finite),signals=ema(diff,9);
  const macd=diff.at(-1)??null,signal=signals.at(-1)??null,ma20=sma(20),ma50=sma(50),ma200=sma(200);
  const std20=v.length>=20?Math.sqrt(mean(v.slice(-20).map(x=>(x-ma20)**2))):null;
  const logs=v.length>=61?v.slice(-60).map((x,i)=>Math.log(x/v[v.length-61+i])):[];
  const vol=logs.length===60?Math.sqrt(logs.reduce((a,x)=>a+(x-mean(logs))**2,0)/59)*Math.sqrt(252)*100:null;
  let peak=v[0],mdd=0;for(const x of v){peak=Math.max(peak,x);mdd=Math.min(mdd,(x/peak-1)*100);}
  const prev=bars.slice(-21,-1).map(b=>b.volume),volumeRatio=prev.length===20&&prev.every(finite)&&mean(prev)>0&&finite(bars.at(-1)?.volume)?bars.at(-1).volume/mean(prev):null;
  return Object.fromEntries(Object.entries({price:last??null,ma20,ma50,ma200,rsi14:rsi(v),macd,signal,histogram:finite(macd)&&finite(signal)?macd-signal:null,bollingerUpper:std20===null?null:ma20+2*std20,bollingerLower:std20===null?null:ma20-2*std20,volumeRatio,annualVolatility:vol,maxDrawdown:v.length>=2?mdd:null,return20:v.length>=21?(last/v.at(-21)-1)*100:null,observations:v.length,periodStart:bars[0]?.date??null,periodEnd:bars.at(-1)?.date??null}).map(([k,x])=>[k,typeof x==='number'?round(x):x]));
}
export const FUND_TYPES=['annualTotalRevenue','annualNetIncome','annualBasicEPS','annualOperatingCashFlow','annualFreeCashFlow'];
export function fundamentals(payload,now=Date.now()) {
  const rows=new Map(),missing=[];
  for(const series of payload?.timeseries?.result??[]){
    const type=series.meta?.type?.[0];if(!FUND_TYPES.includes(type))continue;
    for(const point of series[type]??[]){
      const date=point.asOfDate;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date??'')||Date.parse(date)>now||point.periodType!=='12M'||!finite(point.reportedValue?.raw))continue;
      if(!rows.has(date))rows.set(date,{date,values:{}});
      rows.get(date).values[type]={value:point.reportedValue.raw,currency:point.currencyCode??null};
    }
  }
  const sorted=[...rows.values()].sort((a,b)=>b.date.localeCompare(a.date));
  const latest=sorted.find(x=>finite(x.values.annualTotalRevenue?.value))??sorted[0];
  if(!latest)return {available:false,stale:false,missing:['未取得年度財報；供應商可能未覆蓋此股票。']};
  const previous=sorted.find(x=>{const days=(Date.parse(latest.date)-Date.parse(x.date))/86400000;return days>=330&&days<=400;});
  const currency=latest.values.annualTotalRevenue?.currency??Object.values(latest.values)[0]?.currency;
  const value=(row,key)=>{const item=row?.values[key];return item?.currency===currency&&currency?item.value:null;};
  const revenue=value(latest,'annualTotalRevenue'),netIncome=value(latest,'annualNetIncome'),eps=value(latest,'annualBasicEPS'),ocf=value(latest,'annualOperatingCashFlow'),fcf=value(latest,'annualFreeCashFlow');
  const prevRevenue=value(previous,'annualTotalRevenue'),prevIncome=value(previous,'annualNetIncome');
  for(const [key,label] of [['annualTotalRevenue','營業收入'],['annualNetIncome','淨利'],['annualBasicEPS','每股盈利'],['annualOperatingCashFlow','營運現金流'],['annualFreeCashFlow','自由現金流']]){
    if(!finite(value(latest,key)))missing.push(`${label}：未提供同期間、同幣種資料。`);
  }
  if(!(prevRevenue>0))missing.push('營收增長：缺少可比較的上一年度正收入。');
  const stale=now-Date.parse(latest.date)>2*365.25*86400000;
  if(stale)missing.push('最新年度財報距今超過兩年，不納入評分。');
  return {available:true,period:latest.date,previousPeriod:previous?.date??null,currency,revenue,netIncome,eps,operatingCashFlow:ocf,freeCashFlow:fcf,revenueGrowth:prevRevenue>0&&finite(revenue)?round((revenue/prevRevenue-1)*100):null,netMargin:revenue>0&&finite(netIncome)?round(netIncome/revenue*100):null,previousNetMargin:prevRevenue>0&&finite(prevIncome)?round(prevIncome/prevRevenue*100):null,stale,missing,valuation:{pe:null,pb:null,reason:'免費來源未提供可核實的估值倍數及每股換算口徑，暫不推算市盈率／市帳率。'}};
}
export function score(t,f) {
  const items=[];
  const add=(group,label,weight,available,points,evidence)=>items.push({group,label,weight,available:Boolean(available),points:available?points:null,evidence});
  const cmp=(group,label,a,b,weight=5)=>add(group,label,weight,finite(a)&&finite(b),a>b?weight:0,`${round(a)??'缺漏'} > ${round(b)??'缺漏'}`);
  cmp('趨勢','復權收市價高於 MA20',t.price,t.ma20);cmp('趨勢','復權收市價高於 MA50',t.price,t.ma50);cmp('趨勢','復權收市價高於 MA200',t.price,t.ma200);cmp('趨勢','MA20 高於 MA50',t.ma20,t.ma50);
  cmp('動能','MACD 高於訊號線',t.macd,t.signal,10);cmp('動能','20 個交易日價格回報為正',t.return20,0,10);
  const usable=f.available&&!f.stale;
  const g=f.revenueGrowth;
  add('營收增長','年度營收按年增長',20,usable&&finite(g),g>=20?20:g>=10?15:g>0?10:0,finite(g)?`${g.toFixed(2)}%（≥20%：20分；≥10%：15分；>0%：10分；其餘0分）`:'缺少可比較的年度收入');
  add('盈利','年度淨利為正',10,usable&&finite(f.netIncome),f.netIncome>0?10:0,`${f.currency??''} ${f.netIncome??'缺漏'}`);
  add('盈利','淨利率較上年度改善',10,usable&&finite(f.netMargin)&&finite(f.previousNetMargin),f.netMargin>f.previousNetMargin?10:0,`${f.previousNetMargin??'缺漏'}% → ${f.netMargin??'缺漏'}%`);
  add('現金流','營運現金流為正',10,usable&&finite(f.operatingCashFlow),f.operatingCashFlow>0?10:0,`${f.currency??''} ${f.operatingCashFlow??'缺漏'}`);
  add('現金流','自由現金流為正',10,usable&&finite(f.freeCashFlow),f.freeCashFlow>0?10:0,`${f.currency??''} ${f.freeCashFlow??'缺漏'}`);
  const available=items.filter(x=>x.available),coverage=available.reduce((a,x)=>a+x.weight,0),fundCoverage=available.filter(x=>!['趨勢','動能'].includes(x.group)).reduce((a,x)=>a+x.weight,0),earned=available.reduce((a,x)=>a+x.points,0);
  return {total:coverage>=60&&fundCoverage>=20?Math.round(earned/coverage*100):null,earned,coverage,fundCoverage,items,reason:coverage>=60&&fundCoverage>=20?null:'資料不足：須覆蓋至少 60 分權重，並包含至少 20 分基本面權重。'};
}
const dateFormats=new Map();
function exchangeDate(stamp,tz){if(!dateFormats.has(tz))dateFormats.set(tz,new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}));return dateFormats.get(tz).format(new Date(stamp));}
export function parseChart(payload,symbol,now=Date.now()) {
  const result=payload?.chart?.result?.[0];if(!result||payload.chart.error){const error=new Error('找不到此股票的價格資料，請核對代號。');error.status=404;throw error;}
  const m=result.meta??{},q=result.indicators?.quote?.[0];
  if(!q||m.instrumentType!=='EQUITY'){const error=new Error('第一版只分析港股及美股股票，暫不支援此類證券。');error.status=400;throw error;}
  const tz=m.exchangeTimezoneName??(symbol.endsWith('.HK')?'Asia/Hong_Kong':'America/New_York');
  const today=exchangeDate(now,tz),adj=result.indicators?.adjclose?.[0]?.adjclose??[];
  let usedRaw=false;
  const bars=(result.timestamp??[]).flatMap((ts,i)=>{
    if(!(q.close?.[i]>0&&finite(q.close[i])))return [];
    const adjustedClose=adj[i]>0&&finite(adj[i])?adj[i]:q.close[i];if(!finite(adj[i]))usedRaw=true;
    const date=exchangeDate(ts*1000,tz),end=m.currentTradingPeriod?.regular?.end;
    const complete=date<today||(date===today&&finite(end)&&now>=end*1000&&exchangeDate(end*1000,tz)===today);
    return [{date,close:q.close[i],adjustedClose,volume:finite(q.volume?.[i])?q.volume[i]:null,complete}];
  });
  const completed=bars.filter(b=>b.complete);
  if(!bars.length)throw new Error('可用歷史價格不足。');
  const quoteDate=finite(m.regularMarketTime)?exchangeDate(m.regularMarketTime*1000,tz):bars.at(-1).date;
  const prior=bars.filter(b=>b.date<quoteDate).at(-1);
  const price=finite(m.regularMarketPrice)?m.regularMarketPrice:bars.at(-1).close;
  const previous=finite(m.regularMarketPreviousClose)?m.regularMarketPreviousClose:prior?.close;
  return {symbol:m.symbol??symbol,name:names[symbol]??m.longName??m.shortName??symbol,currency:m.currency??'',exchange:m.fullExchangeName??m.exchangeName??'',exchangeTimezone:tz,marketTime:m.regularMarketTime??null,price,change:finite(previous)?round(price-previous):null,changePercent:previous>0?round((price/previous-1)*100):null,volume:finite(m.regularMarketVolume)?m.regularMarketVolume:bars.at(-1).volume,fiftyTwoWeekHigh:m.fiftyTwoWeekHigh??null,fiftyTwoWeekLow:m.fiftyTwoWeekLow??null,bars,technical:technical(completed),warnings:[...(usedRaw?['部分日期缺少復權價，已使用供應商收市價；公司行動可能影響比較。']:[]),...(completed.length<200?['不足 200 個已完成交易日，部分長期指標未能計算。']:[]),...(bars.some(b=>!b.complete)?['今日交易尚未完成：報價可變動，指標與評分只計已完成交易日。']:[])],priceBasis:'圖表與技術指標使用供應商復權收市價；即時／延遲報價為原始價格。'};
}
export function assembleStock(chart,fin,symbol,now=Date.now()) {
  const stock=parseChart(chart,symbol,now),f=fundamentals(fin,now);
  return {...stock,fundamentals:f,score:score(stock.technical,f),source:{name:'Yahoo Finance 公開價格／年度財務介面',url:`https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`,note:'非即時授權報價；可能延遲、限流或缺漏。'},analyzedAt:new Date(now).toISOString()};
}
