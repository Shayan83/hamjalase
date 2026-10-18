import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationResult} from '../app/lib/conversation.ts';
const draft={title:'مرور پروژه',date:'2030-06-10',time:'10:00',duration:30,agenda:'پیشرفت'};
const active={id:'real-id',token:'abc',url:'http://localhost:8080/call/abc',draft,participants:[],status:'active',calendarSaved:true};
const cancelled={...active,id:'old',status:'cancelled'};
const result=(p,rows=[active,cancelled])=>conversationResult(JSON.stringify(p),rows);
test('cancel all proposes only active actual meetings without altering them',()=>{const r=result({intent:'cancel',scope:'all',draft});assert.equal(r.proposal.kind,'cancel');assert.deepEqual(r.proposal.meetings,[active]);assert.equal(r.requiresConfirmation,undefined);assert.match(r.reply,/هنوز چیزی لغو نشده/);assert.equal(active.status,'active')});
test('no active meetings gives relevant response, never creation guidance',()=>{const r=result({intent:'cancel',scope:'all'},[cancelled]);assert.match(r.reply,/جلسهٔ فعالی/);assert.equal(r.proposal,undefined);assert.equal(r.draft,undefined)});
test('fabricated meeting IDs cannot target any real meeting',()=>{const r=result({intent:'cancel',scope:'selected',ids:['fake']});assert.equal(r.proposal,undefined);assert.match(r.reply,/کدام جلسه/)});
test('ambiguous reschedule asks for selection',()=>{assert.equal(result({intent:'reschedule',ids:[],draft}).proposal,undefined)});
test('reschedule preserves actual meeting contents instead of invented fields',()=>{const r=result({intent:'reschedule',ids:['real-id'],draft:{...draft,title:'invented',time:'15:00'}});assert.equal(r.proposal.draft.title,draft.title);assert.equal(r.proposal.draft.time,'15:00')});
test('list contains real links and omits cancelled links',()=>{const r=result({intent:'list'});assert.equal(r.meetings.length,1);assert.equal(r.meetings[0].url,active.url)});
test('greeting can be conversational',()=>assert.equal(result({intent:'chat',reply:'سلام! چه کمکی برای جلسه‌ها لازم داری؟'}).reply,'سلام! چه کمکی برای جلسه‌ها لازم داری؟'));
test('model cannot report execution or invented links',()=>{const r=result({intent:'chat',reply:'همه جلسه‌ها را لغو کردم: https://fake.example'});assert.doesNotMatch(r.reply,/لغو کردم|fake.example/);assert.equal(r.proposal,undefined)});
test('chat list applies future/cancelled filters and does not invent rows',()=>{
 const r=result({intent:'list',filter:'cancelled'});assert.equal(r.meetings.length,0);assert.match(r.reply,/لغوشده/);
 const empty=result({intent:'list',query:'does-not-exist'});assert.match(empty.reply,/جلسه‌ای با این شرایط/);
});
test('chat reads the selected stored minutes instead of generating execution claims',()=>{
 const r=result({intent:'notes',ids:['real-id']},[{...active,notes:{decisions:'تصمیم واقعی',items:[]}}]);assert.match(r.reply,/تصمیم واقعی/);assert.equal(r.proposal,undefined);
});
