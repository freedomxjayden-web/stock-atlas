import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const terms=JSON.parse(await readFile(new URL('../site/data/terms.json',import.meta.url),'utf8'));
assert.equal(terms.length,200,'Exactly 200 terms');
const ids=new Set(terms.map(t=>t.id));assert.equal(ids.size,200);
const names=new Set(terms.map(t=>t.term));assert.equal(names.size,200);
const cats=new Map();
for(const t of terms){
 for(const field of ['id','category','term','en','level','explanation','example','caution'])assert.ok(typeof t[field]==='string'&&t[field].trim(),`${t.id}: missing ${field}`);
 assert.ok(['入門','中階','進階'].includes(t.level));assert.ok(t.formula===null||typeof t.formula==='string');
 assert.ok(t.related.length>=2&&t.related.every(id=>ids.has(id)&&id!==t.id));
 assert.ok(t.sources.length&&t.sources.every(s=>s.label&&new URL(s.url).protocol==='https:'));
 cats.set(t.category,(cats.get(t.category)??0)+1);
}
assert.equal(cats.size,8);for(const [cat,n] of cats)assert.equal(n,25,cat);
console.log('✓ 200 unique terms · 8 categories × 25 · all explanations, examples, cautions, references and related IDs valid');
