import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeEntries,caption} from '../scripts/telegram-publish.mjs';
const show={slug:'konkel',title:'کنکل',artwork:{src:'https://example.com/cover.jpg'}};
test('only sourced verified episodes, never scheduled-only episodes',()=>{
 const entries=makeEntries([],[
  {series:'konkel',number:12,releasedAt:null,source:{url:'https://example.com/12'}},
  {series:'konkel',number:11,releasedAt:'2026-10-28',summary:'تأیید شده',source:{url:'https://example.com/11'}}
 ],[show],Date.parse('2026-10-31'));
 assert.equal(entries.length,1);
 assert.equal(entries[0].id,'episode:konkel:1:11');
});
test('news without source excluded; caption includes source and site',()=>{
 const entries=makeEntries([
  {series:'konkel',date:'2026-10-30',title:'خبر تازه سریال کنکل',source:'https://example.com/story',summary:'خبر تازه'},
  {series:'konkel',date:'2026-10-30',title:'ادعای بدون منبع'}],[],[show],Date.parse('2026-10-31'));
 assert.equal(entries.length,1);
 assert.match(caption(entries[0]),/ادامه در مشکیدو/);
 assert.match(caption(entries[0]),/#کنکل/);
 assert.match(caption(entries[0]),/example.com\/story/);
});
