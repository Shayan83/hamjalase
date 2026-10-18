import test from 'node:test';
import assert from 'node:assert/strict';
import {creationGuard,requestFingerprint} from '../app/lib/idempotency.ts';
const id='d69af2da-42cb-48cc-8cc0-5b718f631b20';
const draft={title:'Meeting',date:'2030-06-10',time:'10:00',duration:30,agenda:'Agenda'};
test('request fingerprints are stable across property/participant order and change with meeting contents',async()=>{
 const a=await requestFingerprint(draft,['alice','bob']);assert.equal(a,await requestFingerprint({agenda:'Agenda',duration:30,time:'10:00',date:'2030-06-10',title:'Meeting'},['bob','alice']));assert.notEqual(a,await requestFingerprint({...draft,time:'11:00'},['alice','bob']));
});
test('creation reserves with If-None-Match, rejects concurrent claims, and replays stored results',async()=>{
 const prior=globalThis.fetch;let stored=null,etag='"1"';
 try{globalThis.fetch=async(url,init)=>{
  if(init.method==='PUT'){
   if(init.headers['If-None-Match']==='*'&&stored)return new Response('',{status:412});
   if(init.headers['If-Match']&&init.headers['If-Match']!==etag)return new Response('',{status:412});
   stored=JSON.parse(init.body);etag='"2"';return new Response('',{status:201,headers:{ETag:etag}});
  }return stored?Response.json(stored):new Response('',{status:404});
 };
 const guard=creationGuard('https://cloud.test','Basic x','alice',id);assert.equal(await guard.existing('fingerprint'),null);const reserved=await guard.reserve('fingerprint');
 await assert.rejects(guard.reserve('fingerprint'),e=>e.status===409);await assert.rejects(guard.existing('fingerprint'),e=>e.status===409);await assert.rejects(guard.existing('different'),e=>e.status===409);
 const result={url:'https://cloud.test/call/real',calendarSaved:true};await guard.complete('fingerprint',result,reserved);assert.deepEqual(await guard.existing('fingerprint'),result);
 }finally{globalThis.fetch=prior}
});
test('request reservations cannot escape the current user directory',()=>assert.throws(()=>creationGuard('https://cloud.test','Basic x','alice','../../someone')));
