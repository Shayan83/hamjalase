import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarText,meetingStore,addMembers} from '../app/lib/meetings.ts';
import {checkAvailability} from '../app/lib/availability.ts';
import {draftValid} from '../app/lib/chat-result.ts';
const draft={title:'جلسه فارسی، با تیم',date:'2030-06-10',time:'10:00',duration:30,agenda:'خط اول\nخط دوم; مرور'};
const meeting={id:'00000000-0000-4000-8000-000000000000',token:'abc',url:'https://cloud.example/call/abc',draft,participants:[],createdAt:'',status:'active',calendarSaved:true};
test('calendar serialization preserves Tehran time and folds UTF-8 without splitting characters',()=>{
 const text=calendarText({...meeting,draft:{...draft,title:'جلسه '.repeat(35)}});
 assert.match(text,/DTSTART:20300610T063000Z/);assert.match(text,/DTEND:20300610T070000Z/);
 for(const line of text.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 assert.match(text.replace(/\r\n /g,''),/DESCRIPTION:خط اول\\nخط دوم\\; مرور\\nhttps/);
 assert.ok(!text.includes('ATTENDEE'));
});
test('impossible calendar dates fail validation',()=>assert.equal(draftValid({...draft,date:'2030-02-30'}),false));
test('catalog writes use conditional ETag and surface concurrent edits',async()=>{
 const previous=globalThis.fetch;try{
 globalThis.fetch=async(url,init)=>{assert.equal(init.headers['If-Match'],'"v1"');return new Response('',{status:412})};
 await assert.rejects(meetingStore('https://cloud','Basic x','self').write([meeting],'"v1"'),/catalog_conflict/);
 }finally{globalThis.fetch=previous}
});
test('membership failure is reported per user and keeps successful users',async()=>{
 const previous=globalThis.fetch;try{globalThis.fetch=async(url,init)=>new Response('{}',{status:init.body.get('newParticipant')==='good'?200:404});assert.deepEqual(await addMembers('https://cloud','Basic x','abc',['good','missing']),['missing'])}finally{globalThis.fetch=previous}
});
test('free-busy searches the coming week and proposes later days when requested day is full',async()=>{
 const previous=globalThis.fetch;try{
 globalThis.fetch=async(url,init)=>{
 if(url.includes('/cloud/user?'))return Response.json({ocs:{data:{email:'self@example.test'}}});
 assert.match(init.body,/DTEND:20300616T203000Z/);
 return new Response('<schedule-response><response><recipient><href>mailto:self@example.test</href></recipient><request-status>2.0;Success</request-status><calendar-data>BEGIN:VCALENDAR\r\nBEGIN:VFREEBUSY\r\nFREEBUSY:20300610T000000Z/20300611T000000Z\r\nEND:VFREEBUSY\r\nEND:VCALENDAR</calendar-data></response></schedule-response>');
 };
 const result=await checkAvailability('https://cloud','Basic x','self',draft,[]);
 assert.equal(result.busy,true);assert.equal(result.unknown,false);assert.equal(result.suggestions.length,6);assert.equal(result.suggestions[0].date,'2030-06-11');assert.equal(result.suggestions[0].time,'09:00');
 }finally{globalThis.fetch=previous}
});
