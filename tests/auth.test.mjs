import test from 'node:test';
import assert from 'node:assert/strict';
import {sealSession,openSession,sessionCookie,sameOrigin,localAccess} from '../app/lib/auth.ts';
import {connectionFor} from '../app/lib/connection.ts';
const secret='test-only-session-key-'.repeat(3);
const alice={user:'alice',password:'alice-app-password',displayName:'Alice',root:'https://cloud.example.test',expires:Date.now()+60000};
test('session credentials are encrypted, tamper-resistant, expire, and require the correct key',async()=>{
 const token=await sealSession(alice,secret);assert.ok(!token.includes(alice.password));assert.deepEqual(await openSession(token,secret),alice);assert.equal(await openSession(token,secret+'x'),null);assert.equal(await openSession(token,secret,alice.expires+1),null);
 const [iv,data]=token.split('.');assert.equal(await openSession(iv+'.'+(data[0]==='A'?'B':'A')+data.slice(1),secret),null);
});
test('authenticated users never inherit shared admin credentials or change their Nextcloud root',async()=>{
 const saved={...process.env};try{
 process.env.NEXTCLOUD_URL=alice.root;process.env.NEXTCLOUD_USERNAME='shared-admin';process.env.NEXTCLOUD_PASSWORD='admin-password';process.env.SESSION_SECRET=secret;process.env.APP_AUTH_REQUIRED='true';
 for(const identity of [alice,{...alice,user:'bob',password:'bob-app-password'}]){
  const token=await sealSession(identity,secret);const request=new Request('https://agent.example.test/api/agent',{headers:{Cookie:'hamjalase_session='+token}});
  const c=await connectionFor(request,{account:identity.user});assert.equal(c.user,identity.user);assert.equal(c.auth,'Basic '+Buffer.from(identity.user+':'+identity.password).toString('base64'));
  await assert.rejects(connectionFor(request,{account:'someone-else'}),e=>e.status===409);
  await assert.rejects(connectionFor(request,{account:identity.user,url:'https://other.example.test'}),e=>e.status===403);
 }
 await assert.rejects(connectionFor(new Request('https://agent.example.test/api/agent',{headers:{'oai-authenticated-user-id':'spoof','oai-authenticated-user-email':'spoof@example.test'}})),e=>e.status===401);
 }finally{for(const name of Object.keys(process.env))if(!(name in saved))delete process.env[name];Object.assign(process.env,saved)}
});
test('cookies use HttpOnly/SameSite and secure transport; cross-origin posts fail',()=>{
 const cookie=sessionCookie('opaque',new Request('https://agent.example.test/api/auth'));assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Secure/);
 assert.match(sessionCookie('',new Request('https://agent.example.test'),true),/Max-Age=0/);
 assert.equal(sameOrigin(new Request('https://agent.example.test/api/auth',{headers:{Origin:'https://attacker.example.test'}})),false);
});
test('required authentication disables the local development shortcut',()=>{const old=process.env.APP_AUTH_REQUIRED;process.env.APP_AUTH_REQUIRED='true';assert.equal(localAccess(new Request('http://localhost:5173/api/agent')),false);if(old===undefined)delete process.env.APP_AUTH_REQUIRED;else process.env.APP_AUTH_REQUIRED=old});
