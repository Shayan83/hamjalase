import type {MeetingDraft} from './chat-result.ts';
export type ActionItem={id:string;title:string;owner:string;dueDate:string;done:boolean};
export type MeetingNotes={decisions:string;items:ActionItem[]};
export type Meeting={id:string;token:string;url:string;draft:MeetingDraft;participants:string[];status:'active'|'cancelled';createdAt:string;calendarSaved:boolean;pendingParticipants?:string[];updatedAt?:string;notes?:MeetingNotes;pendingRemovals?:string[];roomNameSynced?:boolean};
export function calendarText(m:Meeting){
 const stamp=(v:Date)=>v.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const start=new Date(`${m.draft.date}T${m.draft.time}:00+03:30`),end=new Date(start.getTime()+Number(m.draft.duration)*60000);
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Hamjalase//FA','BEGIN:VEVENT',`UID:${m.id}`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${esc(m.draft.title)}`,`DESCRIPTION:${esc(m.draft.agenda+'\n'+m.url)}`,`LOCATION:${m.url}`,`STATUS:${m.status==='cancelled'?'CANCELLED':'CONFIRMED'}`,'END:VEVENT','END:VCALENDAR',''];
 return lines.flatMap(line=>{const out:string[]=[];let s='';for(const char of line){if(new TextEncoder().encode(s+char).length>75){out.push(s);s=' '}s+=char}out.push(s);return out}).join('\r\n');
}
export function meetingStore(root:string,auth:string,user:string){
 const path=`${root}/remote.php/dav/files/${encodeURIComponent(user)}/Hamjalase-meetings.json`;
 const headers={Authorization:auth};
 return {
 async read(){const r=await fetch(path,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});if(r.status===404)return {meetings:[] as Meeting[],etag:null};if(!r.ok)throw Error('catalog_read');const value:any=await r.json();if(value.version!==1||!Array.isArray(value.meetings))throw Error('catalog_invalid');return {meetings:value.meetings as Meeting[],etag:r.headers.get('etag')};},
 async write(meetings:Meeting[],etag:string|null){const r=await fetch(path,{method:'PUT',headers:{...headers,'Content-Type':'application/json',...(etag?{'If-Match':etag}:{'If-None-Match':'*'})},redirect:'manual',signal:AbortSignal.timeout(15000),body:JSON.stringify({version:1,meetings})});if(!r.ok)throw Error(r.status===412?'catalog_conflict':'catalog_write');},
 eventUrl(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('invalid_id');return `${root}/remote.php/dav/calendars/${encodeURIComponent(user)}/${encodeURIComponent(process.env.NEXTCLOUD_CALENDAR||'personal')}/${id}.ics`;}
 };
}
export async function addMembers(root:string,auth:string,token:string,ids:string[]){
 const failed:string[]=[];
 for(const id of ids){try{const r=await fetch(`${root}/ocs/v2.php/apps/spreed/api/v4/room/${encodeURIComponent(token)}/participants?format=json`,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Authorization:auth,'OCS-APIRequest':'true','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({newParticipant:id,source:'users'})});if(!r.ok)failed.push(id)}catch{failed.push(id)}}return failed;
}

export function participantIds(value:unknown,user:string){
 if(!Array.isArray(value)||value.length>19||value.some(v=>typeof v!=='string'||!v||v.length>100||/[\r\n/]/.test(v)))throw Error('invalid_participants');
 return [...new Set(value as string[])].filter(id=>id!==user);
}
const validDate=(date:string)=>{try{return /^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date}catch{return false}};
export function notesValid(value:any,allowed:string[]):value is MeetingNotes{
 return !!value&&typeof value.decisions==='string'&&value.decisions.length<=8000&&Array.isArray(value.items)&&value.items.length<=30&&new Set(value.items.map((v:any)=>v.id)).size===value.items.length&&value.items.every((v:any)=>typeof v.id==='string'&&/^[a-f0-9-]{36}$/.test(v.id)&&typeof v.title==='string'&&!!v.title.trim()&&v.title.length<=300&&typeof v.done==='boolean'&&allowed.includes(v.owner)&&(v.dueDate===''||validDate(v.dueDate)));
}
export async function syncRoom(root:string,auth:string,meeting:Meeting){
 const path=`${root}/ocs/v2.php/apps/spreed/api/v4/room/${encodeURIComponent(meeting.token)}`;
 const headers={Authorization:auth,'OCS-APIRequest':'true','Content-Type':'application/x-www-form-urlencoded'};
 try{const renamed=await fetch(path+'?format=json',{method:'PUT',headers,redirect:'manual',signal:AbortSignal.timeout(12000),body:new URLSearchParams({roomName:meeting.draft.title})});meeting.roomNameSynced=renamed.ok}catch{meeting.roomNameSynced=false}
 meeting.pendingParticipants=await addMembers(root,auth,meeting.token,meeting.pendingParticipants||[]);
 const removals=meeting.pendingRemovals||[];
 if(removals.length){
  try{const r=await fetch(path+'/participants?format=json',{headers,redirect:'manual',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('members');const body:any=await r.json();const members=body.ocs?.data;if(!Array.isArray(members))throw Error('members');
   const failed:string[]=[];
   for(const id of removals){const member=members.find((p:any)=>p.actorType==='users'&&p.actorId===id);if(!member)continue;
    try{const removed=await fetch(path+'/attendees?format=json',{method:'DELETE',headers,redirect:'manual',signal:AbortSignal.timeout(12000),body:new URLSearchParams({attendeeId:String(member.attendeeId)})});if(!removed.ok&&removed.status!==404)failed.push(id)}catch{failed.push(id)}
   }meeting.pendingRemovals=failed;
  }catch{meeting.pendingRemovals=removals}
 }
 return meeting;
}
export function roomWarning(m:Meeting){return [m.roomNameSynced===false?'عنوان اتاق Talk هنوز همگام نشده است.':'',m.pendingParticipants?.length?'عضویت بعضی افراد تکمیل نشده است.':'',m.pendingRemovals?.length?'حذف دسترسی بعضی افراد از اتاق Talk تکمیل نشده است.':''].filter(Boolean).join(' ')}
