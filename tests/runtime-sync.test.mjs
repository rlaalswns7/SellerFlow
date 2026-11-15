import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startRuntimeSync} from '../src/runtime-sync.js';
const fresh=()=>({version:7,orders:[{id:'CP1',customer:'cloud'}],products:[{id:1}],suppliers:[{id:1}],settings:{systemMode:'테스트'}});
async function fixture({local=null,remote=fresh()}={}){
 const old=Object.fromEntries(['Storage','localStorage','window','document','fetch','setInterval','setTimeout'].map(k=>[k,globalThis[k]]));
 class Storage {constructor(){this.values=new Map();}getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}}
 const storage=new Storage();if(local){storage.setItem('sellerflow_v2_orders',JSON.stringify(local.orders));storage.setItem('sellerflow_v2_products',JSON.stringify(local.products));storage.setItem('sellerflow_v2_suppliers',JSON.stringify(local.suppliers));storage.setItem('sellerflow_v2_settings',JSON.stringify(local.settings));}
 const window=new EventTarget();window.confirm=()=>true;let cloud=structuredClone(remote),revision=1,puts=0,delayPut=null;
 const timers=[];globalThis.Storage=Storage;globalThis.localStorage=storage;globalThis.window=window;globalThis.document={visibilityState:'hidden'};globalThis.setInterval=()=>0;globalThis.setTimeout=(fn,n,...args)=>{const timer=old.setTimeout(fn,n,...args);timers.push(timer);return timer;};
 globalThis.fetch=async(url,options={})=>{
  if(String(url).includes('health'))return{ok:true,json:async()=>({ok:true,runtimeEnabled:true})};
  if(options.method==='PUT'){
   puts++;if(delayPut)await delayPut;
   const body=JSON.parse(options.body);
   if(body.revision!==revision)return{ok:false,status:409,json:async()=>({ok:false,code:'REVISION_CONFLICT',message:'revision conflict'})};
   cloud=body.data;revision++;return{ok:true,json:async()=>({ok:true,revision})};
  }
  return{ok:true,json:async()=>({ok:true,exists:!!cloud,state:cloud,revision})};
 };
 const bridge=await startRuntimeSync();await new Promise(r=>old.setTimeout(r,5));
 return{bridge,storage,get cloud(){return cloud;},set cloud(value){cloud=value;revision++;},get puts(){return puts;},set delayPut(value){delayPut=value;},cleanup(){for(const t of timers)clearTimeout(t);for(const [k,v]of Object.entries(old)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
}
test('cloud initial snapshot loads before UI, no default demo overwrite',async()=>{const h=await fixture();try{assert.equal(JSON.parse(h.storage.getItem('sellerflow_v2_orders'))[0].customer,'cloud');assert.equal(h.bridge.getStatus().paused,false);assert.equal(h.puts,0);}finally{h.cleanup();}});
test('existing divergent browser data pauses rather than silently replacing either copy',async()=>{const local=fresh();local.orders[0].customer='local';const h=await fixture({local});try{assert.equal(h.bridge.getStatus().paused,true);assert.equal(h.cloud.orders[0].customer,'cloud');assert.equal(JSON.parse(h.storage.getItem('sellerflow_v2_orders'))[0].customer,'local');assert.equal(h.puts,0);}finally{h.cleanup();}});
test('cloud revision updates storage and emits the state for React',async()=>{const h=await fixture();try{let event;window.addEventListener('sellerflow-server-state',e=>event=e.detail);const next=fresh();next.orders[0].customer='new cloud';h.cloud=next;await h.bridge.check();assert.equal(event.orders[0].customer,'new cloud');assert.equal(JSON.parse(h.storage.getItem('sellerflow_v2_orders'))[0].customer,'new cloud');}finally{h.cleanup();}});
test('dirty local snapshot and newer server revision become an explicit conflict',async()=>{const h=await fixture();try{const local=JSON.parse(h.storage.getItem('sellerflow_v2_orders'));local[0].customer='unsaved local';h.storage.setItem('sellerflow_v2_orders',JSON.stringify(local));const remote=fresh();remote.orders[0].customer='new cloud';h.cloud=remote;await h.bridge.check();assert.equal(h.bridge.getStatus().paused,true);assert.equal(h.cloud.orders[0].customer,'new cloud');assert.equal(JSON.parse(h.storage.getItem('sellerflow_v2_orders'))[0].customer,'unsaved local');}finally{h.cleanup();}});
test('snapshot writes require the same server revision',async()=>{const h=await fixture();try{const local=JSON.parse(h.storage.getItem('sellerflow_v2_orders'));local[0].customer='local change';h.storage.setItem('sellerflow_v2_orders',JSON.stringify(local));h.cloud=fresh();await assert.rejects(()=>h.bridge.saveNow(),/revision conflict/);assert.equal(h.bridge.getStatus().paused,true);assert.equal(h.cloud.orders[0].customer,'cloud');}finally{h.cleanup();}});
test('cross-tab local storage event pauses autosave',async()=>{const h=await fixture();try{const event=new Event('storage');event.key='sellerflow_v2_orders';window.dispatchEvent(event);assert.equal(h.bridge.getStatus().paused,true);}finally{h.cleanup();}});
test('restoring cloud state keeps a local backup before replacing edits',async()=>{const local=fresh();local.orders[0].customer='preserve local';const h=await fixture({local});try{await h.bridge.restoreNow();const backup=[...h.storage.values.entries()].find(([key])=>key.startsWith('sellerflow_runtime_before_restore_'));assert.ok(backup);assert.equal(JSON.parse(backup[1]).orders[0].customer,'preserve local');assert.equal(JSON.parse(h.storage.getItem('sellerflow_v2_orders'))[0].customer,'cloud');}finally{h.cleanup();}});
test('malformed remote snapshot never replaces local data',async()=>{const h=await fixture();try{h.cloud={orders:{},products:[],suppliers:[]};assert.equal(await h.bridge.check(),false);assert.equal(JSON.parse(h.storage.getItem('sellerflow_v2_orders'))[0].customer,'cloud');}finally{h.cleanup();}});
