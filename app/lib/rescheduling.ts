import {checkAvailability} from './availability.ts';
import type {Meeting} from './meetings';
import type {MeetingDraft} from './chat-result';
const stamp=(ms:number)=>new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const bounds=(d:MeetingDraft)=>{const start=Date.parse(`${d.date}T${d.time}:00+03:30`);return {start,end:start+Number(d.duration)*60000}};
export function uncoveredTime(old:{start:number;end:number},next:{start:number;end:number}){
 const result:{start:number;end:number}[]=[];
 if(next.start<old.start)result.push({start:next.start,end:Math.min(next.end,old.start)});
 if(next.end>old.end)result.push({start:Math.max(next.start,old.end),end:next.end});
 return result.filter(v=>v.end>v.start);
}
export async function checkReschedule(root:string,auth:string,user:string,meeting:Meeting,next:MeetingDraft,participants:string[],eventText:string){
 const previous=bounds(meeting.draft),target=bounds(next);const unfolded=eventText.replace(/\r?\n[ \t]/g,'');
 // Only subtract an old booking when the actual stored event proves its identity and range.
 const lines=unfolded.split(/\r?\n/);const verified=lines.includes('UID:'+meeting.id)&&lines.includes('DTSTART:'+stamp(previous.start))&&lines.includes('DTEND:'+stamp(previous.end));
 if(!verified)return checkAvailability(root,auth,user,next,participants);
 const checks:any[]=[];
 if(participants.length)checks.push(await checkAvailability(root,auth,user,next,participants,false,{skipOrganizer:true}));
 for(const span of uncoveredTime(previous,target)){
  const shifted=new Date(span.start+12600000).toISOString();
  checks.push(await checkAvailability(root,auth,user,{...next,date:shifted.slice(0,10),time:shifted.slice(11,16),duration:(span.end-span.start)/60000},[]));
 }
 const people=new Map<string,{user:string;status:'free'|'busy'|'unknown'}>([[user,{user,status:'free'}]]);
 for(const check of checks)for(const person of check.people){const prior=people.get(person.user);if(!prior||person.status==='unknown'||(person.status==='busy'&&prior.status!=='unknown'))people.set(person.user,person)}
 const rows=[...people.values()];return {people:rows,busy:rows.some(p=>p.status==='busy'),unknown:rows.some(p=>p.status==='unknown'),suggestions:[],checkedAt:new Date().toISOString()};
}
