import test from 'node:test';
import assert from 'node:assert/strict';
import {notesValid,calendarText,participantIds} from '../app/lib/meetings.ts';
import {filterMeetings} from '../app/lib/meeting-filters.ts';
import {checkAvailability} from '../app/lib/availability.ts';
const draft={title:'پروژه کیان',date:'2030-06-10',time:'10:00',duration:30,agenda:'هماهنگی'};
const meeting={id:'abc',token:'real',url:'https://cloud.test/call/real',draft,participants:['bob'],status:'active',createdAt:'',calendarSaved:true};
test('minutes validate assignees, dates, duplicate task IDs and lengths',()=>{
 const task={id:'de9bf850-e498-4aa2-b3cc-df5c4924fe0a',title:'قدم بعدی',owner:'bob',dueDate:'2030-06-12',done:false};const notes={decisions:'تصمیم',items:[task]};
 assert.equal(notesValid(notes,['alice','bob']),true);assert.equal(notesValid(notes,['alice']),false);assert.equal(notesValid({...notes,items:[task,task]},['bob']),false);assert.equal(notesValid({...notes,items:[{...task,dueDate:'2030-02-30'}]},['bob']),false);assert.equal(notesValid({...notes,items:[{...task,dueDate:'9999-99-99'}]},['bob']),false);
});
test('filters normalize Persian letters and separate upcoming, past and cancelled meetings',()=>{
 const past={...meeting,id:'past',draft:{...draft,date:'2020-01-01'}},cancelled={...meeting,id:'cancelled',status:'cancelled'};const rows=[meeting,past,cancelled],now=Date.parse('2026-01-01');
 assert.deepEqual(filterMeetings(rows,'پروژه كيان','upcoming',now).map(m=>m.id),['abc']);assert.deepEqual(filterMeetings(rows,'','past',now).map(m=>m.id),['past']);assert.deepEqual(filterMeetings(rows,'','cancelled',now).map(m=>m.id),['cancelled']);
});
test('calendar exports have stable UIDs and cancellation status without scheduling recipients',()=>{
 const ics=calendarText({...meeting,status:'cancelled'});assert.match(ics,/UID:abc/);assert.match(ics,/STATUS:CANCELLED/);assert.doesNotMatch(ics,/ATTENDEE|ORGANIZER|METHOD:REQUEST/);
});
test('participants are real IDs, deduplicated and never include the organizer twice',()=>{assert.deepEqual(participantIds(['alice','bob','bob'],'alice'),['bob']);assert.throws(()=>participantIds(['bad/id'],'alice'))});
test('common-time search proposes times even when requested slot is already free',async()=>{
 const old=globalThis.fetch;try{globalThis.fetch=async(url)=>url.includes('/cloud/user?')?Response.json({ocs:{data:{email:'alice@example.test'}}}):new Response('<schedule-response><response><recipient><href>mailto:alice@example.test</href></recipient><request-status>2.0;Success</request-status><calendar-data>BEGIN:VCALENDAR\r\nBEGIN:VFREEBUSY\r\nEND:VFREEBUSY\r\nEND:VCALENDAR</calendar-data></response></schedule-response>');
 const report=await checkAvailability('https://cloud.test','Basic x','alice',draft,[],true);assert.equal(report.busy,false);assert.equal(report.suggestions.length,6);
 }finally{globalThis.fetch=old}
});
