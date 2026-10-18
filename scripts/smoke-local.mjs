// A real local workflow. Only the test meeting created here is changed and cancelled.
import assert from 'node:assert/strict';
const endpoint=(process.env.SMOKE_BASE_URL||'http://127.0.0.1:5173')+'/api/agent';
async function api(action,values={}){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(process.env.SMOKE_SESSION_COOKIE?{Cookie:process.env.SMOKE_SESSION_COOKIE}:{})},body:JSON.stringify({action,...(process.env.SMOKE_ACCOUNT?{connection:{account:process.env.SMOKE_ACCOUNT}}:{}),...values})});
 const value=action==='export'&&response.ok?await response.text():await response.json();
 if(!response.ok)throw Error(value.error||`HTTP ${response.status}`);return value;
}
let meeting,creation;
try{
 await api('testNextcloud');console.log('Nextcloud connection: PASS');
 const date=new Date(Date.now()+80*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Tehran'});
 let draft={title:'[تست خودکار] مدیریت جلسه',date,time:'13:00',duration:30,agenda:'جلسهٔ موقت برای تست مسیر واقعی'};
 const availability=await api('suggest',{draft,participants:[]});assert.equal(availability.availability.unknown,false);
 if(availability.availability.busy){assert.ok(availability.availability.suggestions.length);draft={...draft,...availability.availability.suggestions[0]};}
 const requestId=crypto.randomUUID();creation={draft,participants:[],requestId};const created=await api('meeting',{draft,participants:[],requestId});meeting=created.meeting;assert.equal(created.calendarSaved,true);
 const repeated=await api('meeting',{draft,participants:[],requestId});assert.equal(repeated.meeting.id,meeting.id);assert.equal(repeated.replayed,true);console.log('Idempotent creation: PASS');
 let rows=(await api('meetings')).meetings;assert.equal(rows.filter(m=>m.id===requestId).length,1);
 let result=await api('update',{id:meeting.id,expected:meeting,draft:{...draft,title:'[تست خودکار] ویرایش کامل',agenda:'دستور جلسهٔ ویرایش‌شده'},participants:[]});meeting=result.meeting;assert.equal(meeting.draft.agenda,'دستور جلسهٔ ویرایش‌شده');assert.equal(meeting.roomNameSynced,true);console.log('Full edit and Talk name: PASS');
 result=await api('update',{id:meeting.id,expected:meeting,draft:{...meeting.draft,duration:15},participants:[]});meeting=result.meeting;assert.equal(meeting.draft.duration,15);console.log('Overlapping duration edit without self-conflict: PASS');
 const self=(await api('users')).currentUser.id;
 result=await api('notes',{id:meeting.id,expected:meeting,notes:{decisions:'تصمیم آزمایشی',items:[{id:crypto.randomUUID(),title:'کار آزمایشی',owner:self,dueDate:date,done:true}]}});meeting=result.meeting;
 rows=(await api('meetings')).meetings;assert.equal(rows.find(m=>m.id===meeting.id).notes.items[0].done,true);console.log('Persistent minutes and tasks: PASS');
 const exported=await api('export',{id:meeting.id});assert.ok(exported.includes('UID:'+meeting.id));assert.ok(!exported.includes('ATTENDEE'));console.log('Calendar export: PASS');
 if(process.env.SMOKE_TEST_MODEL==='1'){await api('testModel');console.log('Model connection: PASS');}
}finally{if(meeting){await api('cancel',{id:meeting.id,expected:meeting});console.log('Test-only meeting cancelled: PASS');}}
if(creation){await assert.rejects(()=>api('meeting',creation),/لغو/);console.log('Cancelled creation cannot replay a stale working link: PASS');}
