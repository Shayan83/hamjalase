import test from 'node:test';
import assert from 'node:assert/strict';
import {uncoveredTime,checkReschedule} from '../app/lib/rescheduling.ts';
import {calendarText} from '../app/lib/meetings.ts';
test('only newly occupied organizer time is checked for overlapping edits',()=>{
 assert.deepEqual(uncoveredTime({start:10,end:20},{start:12,end:18}),[]);
 assert.deepEqual(uncoveredTime({start:10,end:20},{start:15,end:25}),[{start:20,end:25}]);
 assert.deepEqual(uncoveredTime({start:10,end:20},{start:5,end:25}),[{start:5,end:10},{start:20,end:25}]);
 assert.deepEqual(uncoveredTime({start:10,end:20},{start:30,end:40}),[{start:30,end:40}]);
});
test('shortening a verified own event never collides with itself',async()=>{
 const meeting={id:'own-event',token:'real',url:'https://cloud.test/call/real',draft:{title:'Test',date:'2030-06-10',time:'10:00',duration:30,agenda:''},participants:[],status:'active',createdAt:'',calendarSaved:true};
 const old=globalThis.fetch;try{globalThis.fetch=async()=>{throw Error('No network check should be necessary for a subset of the proven own booking')};const result=await checkReschedule('https://cloud.test','Basic x','self',meeting,{...meeting.draft,duration:15},[],calendarText(meeting));assert.equal(result.busy,false);assert.equal(result.unknown,false)}finally{globalThis.fetch=old}
});
