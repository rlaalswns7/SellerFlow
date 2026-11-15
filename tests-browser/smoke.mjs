import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4179'],{stdio:'ignore'});
let browser;
try{
 const deadline=Date.now()+30000;while(true){try{const r=await fetch('http://127.0.0.1:4179');if(r.ok)break;}catch{}if(Date.now()>deadline)throw Error('Vite startup timeout');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1180,height:820},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const state={version:7,orders:[{id:'CP-1-2-3',source:'coupang',coupangOrderId:'1',shipmentBoxId:'2',coupangVendorItemId:'3',product:'토마토 2kg',option:'2kg',qty:1,saleAmount:21900,supplier:'A농장',customer:'서버 데모고객',phone:'01000000000',address:'서울 테스트로 123',createdAt:'2026-11-14T09:00:00+09:00',date:'11/14',purchaseStatus:'발주완료',purchaseBatchId:'AUTO-1',invoiceStatus:'등록완료',channelStatus:'DEPARTURE'}],products:[{id:1,name:'토마토 2kg',option:'2kg',supplier:'A농장',cost:9000,shippingCost:3000,price:21900,active:true}],suppliers:[{id:1,name:'A농장',active:true}],invoices:[{id:'CP-1-2-3',supplier:'A농장',product:'토마토 2kg',carrier:'CJ대한통운',invoice:'123456789012',status:'등록완료',source:'도매처'}],purchaseBatches:[],purchaseDispatches:[],inquiries:[],returnCases:[],settings:{systemMode:'실운영',theme:'dark',serverAutomationEnabled:false,serverDailyCostLimit:0}};
 let revision=1,cloud=state,runCalls=0,putCalls=0;
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());let data={},status=200;
  if(url.pathname==='/api/automation'){
   const action=url.searchParams.get('action');
   if(action==='health')data={ok:true,runtimeEnabled:true,liveEnabled:false};
   else if(action==='state'&&route.request().method()==='GET')data={ok:true,exists:true,state:cloud,revision};
   else if(action==='state'){
    const body=route.request().postDataJSON();if(body.revision!==revision){status=409;data={ok:false,code:'REVISION_CONFLICT',message:'버전 충돌'};}else{cloud=body.data;revision++;putCalls++;data={ok:true,revision};}
   }else if(action==='status')data={ok:true,jobs:[],revision};
   else if(action==='run'){runCalls++;data={ok:true,dryRun:true,planned:[],blocked:[]};}
   else data={ok:true};
  }else data={ok:true,exists:false};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:4179');
 await page.getByRole('button',{name:'주문내역',exact:true}).click();
 await page.getByText('서버 데모고객',{exact:true}).waitFor();
 assert.equal(await page.locator('body').innerText().then(t=>t.includes('홍길동')),false);
 console.log('PASS browser: server snapshot loaded before React, demo fallback not injected');
 await page.getByRole('button',{name:'운송장 관리',exact:true}).click();
 await page.getByText('등록완료',{exact:true}).waitFor();
 const modify=page.getByRole('button',{name:'수정',exact:true});assert.equal(await modify.isDisabled(),true);
 console.log('PASS browser: real registered invoice cannot be locally modified');
 await page.getByRole('button',{name:'설정',exact:true}).click();
 await page.getByRole('heading',{name:'서버 자동화',exact:true}).waitFor();
 await page.getByRole('button',{name:'외부 전송 없이 점검',exact:true}).click();
 await page.getByText('처리 예정 0건 · 확인 필요 0건',{exact:true}).waitFor();assert.equal(runCalls,1);
 assert.ok(putCalls>=1);
 console.log('PASS browser: runtime settings save and dry-run control work');
 await page.evaluate(()=>window.SellerFlowRuntime.saveNow());
 cloud=structuredClone(cloud);cloud.orders[0].customer='새 서버 변경';revision++;
 await page.evaluate(()=>window.SellerFlowRuntime.check());
 await page.getByRole('button',{name:'주문내역',exact:true}).click();await page.getByText('새 서버 변경',{exact:true}).waitFor();
 console.log('PASS browser: newer cloud revision reflected in visible order table');
 await page.evaluate(()=>{const key='sellerflow_v2_settings',s=JSON.parse(localStorage.getItem(key));s.senderName='local unsaved';localStorage.setItem(key,JSON.stringify(s));});
 cloud=structuredClone(cloud);cloud.orders[0].customer='경합 서버 변경';revision++;
 await page.evaluate(()=>window.SellerFlowRuntime.check());
 assert.equal(await page.evaluate(()=>window.SellerFlowRuntime.getStatus().paused),true);
 assert.equal(cloud.settings.senderName==='local unsaved',false);
 console.log('PASS browser: unsaved local changes stop conflicting cloud overwrites');
 assert.deepEqual(errors,[]);
 console.log('PASS browser: no uncaught JavaScript errors in all scenarios');
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
