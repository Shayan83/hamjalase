import test from 'node:test';
import assert from 'node:assert/strict';
import {completionEndpoint,resolveAIConfig} from '../app/lib/ai-config.ts';
const env={AI_BASE_URL:'https://api.example.test/v1',AI_API_KEY:'server-secret-placeholder',AI_MODEL:'server-model'};
test('base URL and full endpoint both resolve without duplicating the path',()=>{
 assert.equal(completionEndpoint('https://api.example.test/v1/'),'https://api.example.test/v1/chat/completions');
 assert.equal(completionEndpoint('https://api.example.test/v1/chat/completions'),'https://api.example.test/v1/chat/completions');
});
test('empty session settings use the configured server provider',()=>{
 assert.deepEqual(resolveAIConfig({},env),{endpoint:'https://api.example.test/v1/chat/completions',key:env.AI_API_KEY,model:env.AI_MODEL});
});
test('changing provider never forwards the server key or model',()=>{
 const result=resolveAIConfig({apiBaseUrl:'https://another.example.test/custom/v2',model:'another-model'},env);
 assert.equal(result.key,'');assert.equal(result.model,'another-model');assert.equal(result.endpoint,'https://another.example.test/custom/v2/chat/completions');
 assert.throws(()=>resolveAIConfig({apiBaseUrl:'https://another.example.test/v1'},env),/نام مدل/);
});
test('different path on the same host also isolates server credentials',()=>{
 assert.equal(resolveAIConfig({apiBaseUrl:'https://api.example.test/other',model:'local'},env).key,'');
});
test('an explicitly supplied key is used only for the chosen endpoint',()=>{
 assert.equal(resolveAIConfig({apiBaseUrl:'https://another.example.test/v1',model:'chosen',key:'session-key-placeholder'},env).key,'session-key-placeholder');
});
test('equivalent configured endpoints can reuse their own server credential',()=>{
 assert.equal(resolveAIConfig({apiBaseUrl:env.AI_BASE_URL+'/chat/completions'},env).key,env.AI_API_KEY);
});
test('local unauthenticated models work, while unsafe URLs and header injection fail',()=>{
 assert.equal(resolveAIConfig({apiBaseUrl:'http://localhost:11434/v1',model:'local-model'},{}).key,'');
 for(const value of ['file:///etc/passwd','http://public.example/v1','https://user:secret@example.test/v1','https://example.test/v1?token=secret','https://example.test/v1#secret'])assert.throws(()=>completionEndpoint(value));
 assert.throws(()=>resolveAIConfig({key:'key\r\nInjected: yes'},env));
});
