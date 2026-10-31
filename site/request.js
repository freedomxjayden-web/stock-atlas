/** Abort both network and response-body reads, and distinguish timeout from navigation. */
export async function requestStock(url,{signal,timeout=20000,fetcher=fetch}={}) {
 const controller=new AbortController();let timedOut=false;
 const abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeout);
 try {
  const response=await fetcher(url,{signal:controller.signal});
  let data;try{data=await response.json();}catch(e){if(controller.signal.aborted)throw e;throw new Error('資料服務回應格式有誤，請稍後重試。');}
  if(!response.ok){const messages={400:'代號格式不正確，請核對港股或美股代號。',404:'找不到呢隻股票，請核對代號。',429:'查詢較頻密，請稍等一分鐘再試。',502:'上游資料暫不可用，請稍後重試。'};throw new Error(messages[response.status]??data?.error??'暫時無法取得資料。');}
  if(!data||!Array.isArray(data.bars)||!data.bars.length||!data.technical||!data.fundamentals||!data.score||!Array.isArray(data.score.items)||!data.source)throw new Error('股票資料未完整，請稍後重試。');
  return data;
 }catch(e){if(timedOut)throw new Error('查詢逾時，請檢查網絡或稍後重試。');throw e;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
