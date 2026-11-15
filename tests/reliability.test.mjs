import { test } from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import * as rules from '../src/reliability.js';
const {parseInvoiceFile, planInvoiceImport, invoiceValueIssues, resolveHeaders, mergeSyncedOrder, validateBackup, safeFileName, safeSheetName} = rules;
const headers = ['주문번호', '택배사', '운송장번호'];
const orders = [{id:'C10002',supplier:'A농장',purchaseStatus:'발주완료'}];
const invoices = [{id:'C10002',supplier:'A농장',carrier:'',invoice:'',status:'송장대기'}];
export function file(rows, name='송장.xlsx', alter) {
 const wb=XLSX.utils.book_new();
 const ws=XLSX.utils.aoa_to_sheet(rows); if(alter)alter(ws,wb);
 XLSX.utils.book_append_sheet(wb,ws,'송장');
 const bytes=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
 return {name,size:bytes.length,arrayBuffer:async()=>{
   // xlsx-js-style incorrectly serializes a digits-only custom format as an ID.
   // Repair this fixture to standard OOXML, as a real Excel zero-padding format.
   if(ws.C2?.z === '000000000000') {
    const zip=await JSZip.loadAsync(bytes);
    let xml=await zip.file('xl/styles.xml').async('string');
    xml=xml.replace('<numFmts count="0"/>','<numFmts count="1"><numFmt numFmtId="164" formatCode="000000000000"/></numFmts>').replaceAll('numFmtId="000000000000"','numFmtId="164"');
    zip.file('xl/styles.xml',xml); return zip.generateAsync({type:'nodebuffer'});
   }
   return bytes;
 }};
}
const parse = f => parseInvoiceFile(f,XLSX,[{name:'A농장'},{name:'C농장'}]);
const plan = (files, os=orders, ins=invoices, cs=[]) => planInvoiceImport(files,os,ins,cs);
// 6 carrier categories × 6 tracking boundaries × 4 lifecycle states = 144 end-to-end input combinations.
for (const [carrier, goodCarrier] of [['CJ대한통운',true],['cj',true],['한진택배',true],['09/23',false],['없는택배사',false],['',false]]) {
 for (const [number, goodNumber] of [['123456789012',true],['001234567890',true],['김민준',false],['123',false],['1e12',false],['',false]]) {
  for (const state of ['발주완료','발주대기','보류','환불']) {
   test(`matrix carrier=${carrier || 'empty'} invoice=${number || 'empty'} state=${state}`,async()=>{
    const os=[{...orders[0],purchaseStatus:state==='발주대기'?'발주대기':'발주완료',hold:state==='보류'}];
    const cs=state==='환불'?[{orderId:'C10002',processed:true,resolution:'환불'}]:[];
    const p=plan([await parse(file([headers,['C10002',carrier,number]]))],os,invoices,cs);
    assert.equal(p.valid.length,goodCarrier && goodNumber && state==='발주완료'?1:0);
    assert.deepEqual(invoices,[{id:'C10002',supplier:'A농장',carrier:'',invoice:'',status:'송장대기'}]);
   });
  }
 }
}
test('purchase workbook reproducer is rejected before mutation',async()=>{
 await assert.rejects(()=>parse(file([['주문번호','주문일','수취인','상품명','옵션','수량','보내는사람','연락처','주소'],['C10002','09/23','테스트고객','토마토 2kg','2kg',1,'발송인','01000000000','테스트 주소']],'A농장_2026-10-15_발주서.xlsx')),/택배사.*없/);
});
for(const cols of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]) test(`reordered headers ${cols}`,async()=>{
 const values=['C10002','CJ대한통운','123456789012']; const p=plan([await parse(file([cols.map(i=>headers[i]),cols.map(i=>values[i])]))]);assert.equal(p.valid.length,1);
});
for(const [label,hs] of [['missing order',['고객','택배사','운송장번호']],['missing carrier',['주문번호','상품명','운송장번호']],['missing invoice',['주문번호','택배사','수취인']],['duplicate header',['주문번호','택배사','운송장번호','택배사']],['two aliases',['주문번호','택배사','운송장번호','송장번호']]]) test(label,()=>assert.throws(()=>resolveHeaders(hs)));
test('BOM, spaces, full-width normalized',async()=>{assert.equal(plan([await parse(file([['\ufeff 주문번호 ','택 배 사','운송장 번호'],[' C10002 ','ＣＪ','１２３４５６７８９０１２']]))]).valid[0].carrier,'CJ대한통운');});
test('mapping may not overlap',()=>assert.throws(()=>resolveHeaders(headers,{carrier:'운송장번호'}),/겹칩니다/));
test('custom supplier mapping used only for identified supplier',async()=>{
 const f=file([['외부주문','운송사','배송번호'],['C10002','CJ','123456789012']],'A농장_송장.xlsx');
 const p=await parseInvoiceFile(f,XLSX,[{name:'A농장',invoiceMapOrderId:'외부주문',invoiceMapCarrier:'운송사',invoiceMapInvoice:'배송번호'}]);assert.equal(plan([p]).valid.length,1);
 await assert.rejects(()=>parseInvoiceFile({...f,name:'일반.xlsx'},XLSX,[{name:'A농장',invoiceMapOrderId:'외부주문',invoiceMapCarrier:'운송사',invoiceMapInvoice:'배송번호'}]));
});
for (const [label,cell] of [['formula',{t:'n',v:123456789012,f:'1+2'}],['error',{t:'e',v:7}],['date',{t:'n',v:45000,z:'m/d/yy'}],['precision loss',{t:'n',v:12345678901234568}],['fraction',{t:'n',v:12345678.5}],['zero padded numeric',{t:'n',v:12345678,z:'000000000000'}],['scientific format',{t:'n',v:123456789012,z:'0.00E+00'}],['boolean',{t:'b',v:true}]]) test(`cell rejects ${label}`,async()=>{
 const f=file([headers,['C10002','CJ','123456789012']],'송장.xlsx',ws=>ws.C2={...cell,s:cell.z?{numFmt:cell.z}:undefined});assert.equal(plan([await parse(f)]).valid.length,0);
});
test('safe 12-digit numeric is accepted',async()=>assert.equal(plan([await parse(file([headers,['C10002','CJ',123456789012]]))]).valid.length,1));
for(const value of ['1234567','1'.repeat(31),'1234-5678','1234 5678','09/23','=12345678'])test(`invalid tracking ${value}`,()=>assert.ok(invoiceValueIssues('CJ',value).length));
for(const value of ['12345678','1'.repeat(30),'000123456789'])test(`text boundary accepted ${value}`,()=>assert.equal(invoiceValueIssues('CJ',value).length,0));
test('unknown order isolated',async()=>{const p=plan([await parse(file([headers,['C10002','CJ','123456789012'],['C99999','CJ','123456789013']]))]);assert.equal(p.valid.length,1);assert.equal(p.results[0].failed,1);});
test('same order different tracking blocks all conflicting rows',async()=>{const p=plan([await parse(file([headers,['C10002','CJ','123456789012'],['C10002','CJ','123456789013']]))]);assert.equal(p.valid.length,0);assert.equal(p.results[0].failed,2);});
test('identical rows are applied once',async()=>{const p=plan([await parse(file([headers,['C10002','CJ','123456789012'],['C10002','CJ','123456789012']]))]);assert.equal(p.valid.length,1);assert.equal(p.results[0].skipped,1);});
test('duplicate filenames have independent results',async()=>{const p=plan([await parse(file([headers,['C10002','CJ','123456789012']])),{fileName:'송장.xlsx',error:'읽기 실패',entries:[]}]);assert.equal(p.results.length,2);assert.notEqual(p.results[0].key,p.results[1].key);assert.equal(p.valid.length,1);assert.equal(p.results[1].failed,1);});
test('multiple sheets inspected',async()=>{const f=file([headers,['C10002','CJ','123456789012']],'송장.xlsx',(_,wb)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers,['C99999','CJ','123456789013']]),'추가'));const p=plan([await parse(f)]);assert.equal(p.valid.length,1);assert.equal(p.results[0].failed,1);});
test('wrong supplier filename blocked',async()=>assert.equal(plan([await parse(file([headers,['C10002','CJ','123456789012']],'C농장_송장.xlsx'))]).valid.length,0));
test('registered order cannot be overwritten',async()=>{const p=plan([await parse(file([headers,['C10002','CJ','123456789012']]))],orders,[{...invoices[0],status:'등록완료(테스트)'}]);assert.equal(p.valid.length,0);});
test('existing valid tracking cannot be silently replaced',async()=>{const p=plan([await parse(file([headers,['C10002','CJ','123456789012']]))],orders,[{...invoices[0],carrier:'CJ',invoice:'123456789013'}]);assert.equal(p.valid.length,0);});
test('old date/name corruption can be corrected by a valid file',async()=>{const p=plan([await parse(file([headers,['C10002','CJ','123456789012']]))],orders,[{...invoices[0],carrier:'09/23',invoice:'김민준'}]);assert.equal(p.valid.length,1);});
test('identical re-upload is idempotent',async()=>{const p=plan([await parse(file([headers,['C10002','CJ','123456789012']]))],orders,[{...invoices[0],carrier:'CJ대한통운',invoice:'123456789012'}]);assert.equal(p.valid.length,0);assert.equal(p.results[0].skipped,1);});
test('tracking reused across orders rejected',async()=>{const p=plan([await parse(file([headers,['C10002','CJ','123456789012']]))],orders,[...invoices,{id:'C10003',carrier:'CJ',invoice:'123456789012'}]);assert.equal(p.valid.length,0);});
test('duplicate tracking in one upload rejected',async()=>{const p=plan([await parse(file([headers,['C10002','CJ','123456789012'],['C10003','CJ','123456789012']]))],[...orders,{...orders[0],id:'C10003'}],[...invoices,{...invoices[0],id:'C10003'}]);assert.equal(p.valid.length,0);assert.equal(p.results[0].failed,2);});
for(const f of [{name:'a.xlsx',size:0,arrayBuffer:async()=>new Uint8Array()},{name:'a.xlsx',size:11*1024*1024},{name:'a.pdf',size:100}])test(`file boundary ${f.name}/${f.size}`,async()=>assert.rejects(()=>parse(f)));
test('corrupt binary rejected',async()=>assert.rejects(()=>parse({name:'a.xlsx',size:8,arrayBuffer:async()=>Buffer.from('not xlsx')})));
test('empty data sheet rejected',async()=>assert.rejects(()=>parse(file([headers]))));
test('blank lines ignored',async()=>{const p=plan([await parse(file([headers,[],['C10002','CJ','123456789012'],['','','']]))]);assert.equal(p.valid.length,1);assert.equal(p.results[0].failed,0);});
for(const status of ['발주완료','등록완료(테스트)','묶음존재'])test(`resync preserves fulfillment ${status}`,()=>{
 const o={...orders[0],id:'local',product:'토마토',qty:2,invoiceStatus:status==='등록완료(테스트)'?status:'송장대기',purchaseStatus:status==='발주완료'?status:'기타',purchaseBatchId:status==='묶음존재'?'PO-X':undefined};
 const n=mergeSyncedOrder(o,{id:'upstream',product:'바뀐상품',qty:1,supplier:'미연결',purchaseStatus:'발주대기',invoiceStatus:'송장대기',channelStatus:'수정'});assert.equal(n.id,'local');assert.equal(n.purchaseStatus,o.purchaseStatus);assert.equal(n.supplier,'A농장');assert.equal(n.qty,2);assert.equal(n.channelStatus,'수정');
});
test('resync retains hold memo and supplier override',()=>{const n=mergeSyncedOrder({id:'C',hold:true,internalMemo:'메모',supplierOverride:'A',favorite:true},{id:'C',hold:false,internalMemo:''});assert.equal(n.hold,true);assert.equal(n.internalMemo,'메모');assert.equal(n.supplierOverride,'A');assert.equal(n.favorite,true);});
test('safe filename prevents path export',()=>{assert.equal(safeFileName('../../A/B:*?'), '_.._A_B___');assert.ok(!/[\\/:*?"<>|]/.test(safeFileName('A/B:C')));});
test('invalid sheet names sanitized and shortened',()=>{assert.equal(safeSheetName("'a/b:c[d]*?'"),'a_b_c_d___');assert.equal(safeSheetName('가'.repeat(40)).length,31);});
const backup={version:7,orders:[{id:'C1'}],products:[{id:1}],suppliers:[{id:2}]};
test('numeric legacy IDs accepted in backup',()=>assert.equal(validateBackup(backup),backup));
for(const [name,b] of [['array',[]],['missing',{}],['wrong array',{...backup,orders:{}}],['duplicate',{...backup,orders:[{id:'C1'},{id:'C1'}]}],['missing id',{...backup,invoices:[{}]}],['bad settings',{...backup,settings:[]}],['future version',{...backup,version:99}],['bad batch',{...backup,purchaseBatches:[{id:'P'}]}]])test(`backup rejects ${name}`,()=>assert.throws(()=>validateBackup(b)));
