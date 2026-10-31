export const LEARNING_KEY = 'stock-atlas-learning-v1';
export const LESSONS = [
 {id:'market',title:'市場基礎',intro:'由持有一家公司嘅一部分，開始理解價格、規模同交易。',terms:['t001','t007','t082'],question:'股價較高，是否代表公司市值一定較大？',choices:['一定，股價就係公司規模。','唔一定，仲要考慮已發行股份數目。'],answer:1,explanation:'市值係股價乘已發行股份數目；只比較股價唔能夠比較公司規模。'},
 {id:'finance',title:'財務基礎',intro:'分清收入、盈利、每股盈利及現金流，留意財報期間與幣種。',terms:['t051','t052','t053','t062'],question:'營業收入 100 萬，淨利 10 萬，是否代表實際收到 10 萬現金？',choices:['未必，盈利同現金流嘅確認時間及項目可以不同。','係，淨利一定等於收到嘅現金。'],answer:0,explanation:'收入減費用形成盈利；應收款、折舊等會令盈利同現金流不同。要另看現金流量表。'},
 {id:'risk',title:'風險與限制',intro:'了解歷史波動、最大回撤及分散風險，唔將歷史當保證。',terms:['t151','t152','t156'],question:'歷史最大回撤為 20%，未來跌幅是否最多只有 20%？',choices:['係，歷史最大值就係風險上限。','唔係，未來損失可能更大。'],answer:1,explanation:'最大回撤只描述指定歷史期間；市場改變後，未來跌幅可以超過歷史值。'},
 {id:'research',title:'實際閱讀一隻股票',intro:'開啟 700 或 AAPL，辨認市場時間、財報幣種同評分覆蓋率；資料暫不可用時可稍後再完成。',terms:['t051','t152'],tasks:['我已找到報價時間與市場時區。','我已辨認財報年度、財報幣種及缺漏狀態。','我已展開評分依據，找到覆蓋率與限制。'],question:'觀察分 80、資料覆蓋率 60%，應怎樣理解？',choices:['符合部分規則，仍需閱讀缺漏項目，唔代表回報保證。','代表未來有 80% 機會賺錢。'],answer:0,explanation:'觀察分係已取得分數除以可用權重；覆蓋率講有幾多資料可用，兩者都唔係回報機率。'}
];
export function blankProgress() {return {version:1,read:[],answers:{},tasks:[],completed:[]};}
export function readProgress(storage) {
 try {
  const v=JSON.parse((storage??localStorage).getItem(LEARNING_KEY)??'null');if(v?.version!==1)return blankProgress();
  const ids=LESSONS.map(x=>x.id),terms=new Set(LESSONS.flatMap(x=>x.terms)),tasks=LESSONS.flatMap(x=>(x.tasks??[]).map((_,i)=>x.id+'-'+i));
  const p={version:1,read:Array.isArray(v.read)?[...new Set(v.read.filter(x=>terms.has(x)))]:[],answers:{},tasks:Array.isArray(v.tasks)?v.tasks.filter(x=>tasks.includes(x)):[],completed:[]};
  for(const lesson of LESSONS)if(Number.isInteger(v.answers?.[lesson.id])&&v.answers[lesson.id]>=0&&v.answers[lesson.id]<lesson.choices.length)p.answers[lesson.id]=v.answers[lesson.id];
  p.completed=Array.isArray(v.completed)?[...new Set(v.completed.filter(x=>ids.includes(x)&&canComplete(p,LESSONS.find(l=>l.id===x))))]:[];
  return p;
 }catch{return blankProgress();}
}
export function canComplete(p,l) {return l.terms.every(id=>p.read.includes(id))&&p.answers[l.id]===l.answer&&(l.tasks??[]).every((_,i)=>p.tasks.includes(l.id+'-'+i));}
export function writeProgress(p,storage) {try{(storage??localStorage).setItem(LEARNING_KEY,JSON.stringify(p));return true;}catch{return false;}}
