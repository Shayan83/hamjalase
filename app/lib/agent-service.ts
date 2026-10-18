import {checkReschedule} from './rescheduling.ts';
import {handleChat} from './chat.ts';
import {meetingStore,calendarText,participantIds,notesValid,syncRoom,roomWarning,type Meeting} from './meetings.ts';
import {checkAvailability} from './availability.ts';
import {listUsers} from './user-directory.ts';
import {draftValid} from './chat-result.ts';
import {creationGuard,requestFingerprint} from './idempotency.ts';
import {RequestError} from './connection.ts';
import {resolveAIConfig} from './ai-config.ts';
export type Connection={root:string;auth:string;user:string;browserRoot:string};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function testModel(data:any){
 let config;try{config=resolveAIConfig(data,process.env)}catch(e){throw new RequestError(e instanceof Error?e.message:'تنظیمات مدل معتبر نیست.')}
 const r=await fetch(config.endpoint,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',...(config.key?{Authorization:`Bearer ${config.key}`}:{})},body:JSON.stringify({model:config.model,stream:false,messages:[{role:'user',content:'Reply with OK.'}]})});
 if(!r.ok)throw new RequestError(r.status===401||r.status===403?'کلید API یا دسترسی مدل تأیید نشد.':r.status===404?'آدرس API یا نام مدل پیدا نشد.':r.status===429?'سهمیه یا محدودیت درخواست سرویس مدل را بررسی کن.':`سرویس مدل پاسخ ناموفق داد (${r.status}).`,502);
 const value:any=await r.json();if(typeof value.choices?.[0]?.message?.content!=='string')throw new RequestError('پاسخ سرویس با قالب Chat Completions سازگار نیست.',502);
 return json({ok:true,message:'اتصال API، کلید و نام مدل تأیید شدند.'});
}
export async function dispatchAgent(data:any,c:Connection){
 const {root,auth,user,browserRoot}=c;
 if(data.action==='testModel')return testModel(data);
 if(data.action==='chat')return handleChat(data,root,auth,user);
 if(data.action==='users')return json(await listUsers(root,auth,user,typeof data.query==='string'?data.query:''));
 if(data.action==='testNextcloud'){
  const self=await listUsers(root,auth,user,'');const talk=await fetch(`${root}/ocs/v2.php/apps/spreed/api/v4/room?format=json`,{headers:{Authorization:auth,'OCS-APIRequest':'true'},redirect:'manual',signal:AbortSignal.timeout(12000)});
  const calendar=await fetch(`${root}/remote.php/dav/calendars/${encodeURIComponent(user)}/${encodeURIComponent(process.env.NEXTCLOUD_CALENDAR||'personal')}/?export`,{headers:{Authorization:auth},redirect:'manual',signal:AbortSignal.timeout(12000)});
  if(!talk.ok||!calendar.ok)throw new RequestError(`ورود تأیید شد، اما دسترسی ${!talk.ok?'Talk':'تقویم'} برقرار نیست.`,502);
  return json({ok:true,message:`اتصال حساب ${self.currentUser.displayName}، Talk و تقویم تأیید شد.`});
 }
 const store=meetingStore(root,auth,user);
 if(data.action==='meetings')return json({meetings:(await store.read()).meetings});
 if(['availability','suggest','meeting'].includes(data.action)){
  if(!draftValid(data.draft))throw new RequestError('عنوان، تاریخ، ساعت و مدت جلسه را کامل کن.');
  const d=data.draft;let participants:string[];try{participants=participantIds(data.participants||[],user)}catch{throw new RequestError('شرکت‌کننده‌ها معتبر نیستند.')}
  let guard:ReturnType<typeof creationGuard>|null=null,fingerprint='';
  const requestId=typeof data.requestId==='string'?data.requestId.toLowerCase():'';
  if(data.action==='meeting'){
   guard=creationGuard(root,auth,user,requestId);fingerprint=await requestFingerprint(d,participants);
   const existing=await guard.existing(fingerprint);if(existing){const latest=(await store.read()).meetings.find(m=>m.id===existing.meeting?.id);if(latest?.status==='cancelled')throw new RequestError('جلسهٔ این درخواست قبلاً لغو شده است؛ برای جلسهٔ تازه گفت‌وگوی جدید باز کن.',409);return json({...existing,...(latest?{meeting:latest,url:latest.url,calendarSaved:latest.calendarSaved}:{}),replayed:true})}
  }
  const availability=await checkAvailability(root,auth,user,d,participants,data.action==='suggest');
  if(data.action!=='meeting')return json({availability});
  if(availability.busy||availability.unknown)return json({error:availability.unknown?'وضعیت تقویم بعضی افراد قابل تأیید نیست.':'این زمان با تقویم افراد تداخل دارد.',availability},409);
  await store.read();const etag=await guard!.reserve(fingerprint);
  let meeting:Meeting|null=null;
  try{
   const r=await fetch(`${root}/ocs/v2.php/apps/spreed/api/v4/room?format=json`,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(30000),headers:{Authorization:auth,'OCS-APIRequest':'true','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({roomType:'3',roomName:d.title.trim()})});
   if(!r.ok)throw Error('room_create');const value:any=await r.json();const token=value.ocs?.data?.token;if(typeof token!=='string'||!token)throw Error('room_token');
   meeting={id:requestId,token,url:`${browserRoot}/call/${encodeURIComponent(token)}`,draft:d,participants,status:'active',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),calendarSaved:false,pendingParticipants:participants,pendingRemovals:[],roomNameSynced:true};
   const saved=await fetch(store.eventUrl(meeting.id),{method:'PUT',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Authorization:auth,'Content-Type':'text/calendar; charset=utf-8','If-None-Match':'*'},body:calendarText(meeting)});
   meeting.calendarSaved=saved.ok;
   await syncRoom(root,auth,meeting);
   let warning=roomWarning(meeting);if(!meeting.calendarSaved)warning+=' ثبت تقویم انجام نشد.';
   try{await appendMeeting(store,meeting)}catch{warning+=' ذخیره فهرست تأیید نشد؛ لینک را نگه دار و جلسه تکراری نساز.'}
   const response={status:meeting.calendarSaved?'created':'room_created',meeting,url:meeting.url,calendarSaved:meeting.calendarSaved,warning,local:['localhost','127.0.0.1'].includes(new URL(meeting.url).hostname)};
   try{await guard!.complete(fingerprint,response,etag)}catch{response.warning+=' نتیجهٔ درخواست کامل ذخیره نشد؛ پیش از تلاش مجدد فهرست و Talk را بررسی کن.'}
   return json(response);
  }catch{
   if(meeting){
    try{await appendMeeting(store,meeting)}catch{}
    const response={status:'room_created',meeting,url:meeting.url,calendarSaved:meeting.calendarSaved,warning:'اتاق ساخته شد، ولی تکمیل عملیات تأیید نشد. از همین لینک استفاده کن و اتاق تکراری نساز.'};
    try{await guard!.complete(fingerprint,response,etag)}catch{}
    return json(response);
   }
   throw new RequestError('نتیجهٔ ساخت اتاق تأیید نشد. شناسهٔ درخواست حفظ شده تا اتاق تکراری ساخته نشود؛ Talk را بررسی کن.',502);
  }
 }
 if(!['export','notes','update','reschedule','cancel','retryMembers'].includes(data.action))throw new RequestError('عملیات شناخته‌شده نیست.');
 const catalog=await store.read();const meeting=catalog.meetings.find(m=>m.id===data.id);
 if(!meeting)throw new RequestError('جلسه پیدا نشد؛ فهرست را تازه کن.',404);
 if(data.action==='export')return new Response(calendarText(meeting),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':`attachment; filename="meeting-${meeting.id}.ics"`,'Cache-Control':'no-store'}});
 if(!data.expected||JSON.stringify(data.expected.draft)!==JSON.stringify(meeting.draft)||(data.expected.updatedAt||data.expected.createdAt)!==(meeting.updatedAt||meeting.createdAt))throw new RequestError('جلسه پس از بازشدن فرم تغییر کرده؛ فهرست را تازه کن.',409);
 if(data.action==='notes'){
  if(!notesValid(data.notes,[user,...meeting.participants,...(meeting.notes?.items.map(t=>t.owner)||[])]))throw new RequestError('متن تصمیم‌ها یا مسئول و موعد کارها معتبر نیست.');meeting.notes=data.notes;
 }else{
  if(meeting.status==='cancelled')throw new RequestError('این جلسه لغو شده است.',409);
  if(data.action==='retryMembers')await syncRoom(root,auth,meeting);
  else{
   const event=await fetch(store.eventUrl(meeting.id),{headers:{Authorization:auth},redirect:'manual',signal:AbortSignal.timeout(15000)});
   if(!event.ok&&!(event.status===404&&(data.action==='cancel'||!meeting.calendarSaved)))throw new RequestError('رویداد تقویم در دسترس نیست.',409);
   const etag=event.headers.get('etag');
   if(['update','reschedule'].includes(data.action)){
    if(!draftValid(data.draft))throw new RequestError('مشخصات جلسه معتبر نیست.');
    let participants=meeting.participants;if(data.action==='update'){try{participants=participantIds(data.participants,user)}catch{throw new RequestError('شرکت‌کننده‌ها معتبر نیستند.')}}
    const d=data.draft;
    const added=participants.filter(id=>!meeting.participants.includes(id));
    const availability=await checkReschedule(root,auth,user,meeting,d,participants,event.ok?await event.text():'');
    if(availability&&(availability.busy||availability.unknown))return json({error:'زمان یا شرکت‌کنندهٔ جدید تداخل دارد یا وضعیت تقویم قابل تأیید نیست.',availability},409);
    const updated:Meeting={...meeting,draft:d,participants,calendarSaved:true,pendingParticipants:[...new Set([...(meeting.pendingParticipants||[]),...added])].filter(id=>participants.includes(id)),pendingRemovals:[...new Set([...(meeting.pendingRemovals||[]),...meeting.participants.filter(id=>!participants.includes(id))])].filter(id=>!participants.includes(id))};
    const r=await fetch(store.eventUrl(meeting.id),{method:'PUT',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Authorization:auth,'Content-Type':'text/calendar; charset=utf-8',...(etag?{'If-Match':etag}:{'If-None-Match':'*'})},body:calendarText(updated)});
    if(!r.ok)throw new RequestError('ذخیرهٔ تغییرات تقویم انجام نشد.',409);Object.assign(meeting,updated);await syncRoom(root,auth,meeting);
   }else{
    if(event.ok){const r=await fetch(store.eventUrl(meeting.id),{method:'DELETE',headers:{Authorization:auth,...(etag?{'If-Match':etag}:{})},redirect:'manual',signal:AbortSignal.timeout(15000)});if(!r.ok&&r.status!==404)throw new RequestError('حذف رویداد انجام نشد.',502)}
    const r=await fetch(`${root}/ocs/v2.php/apps/spreed/api/v4/room/${encodeURIComponent(meeting.token)}?format=json`,{method:'DELETE',headers:{Authorization:auth,'OCS-APIRequest':'true'},redirect:'manual',signal:AbortSignal.timeout(15000)});
    if(!r.ok&&r.status!==404)throw new RequestError('رویداد حذف شد، ولی اتاق Talk حذف نشد؛ لغو را دوباره انجام بده.',502);meeting.status='cancelled';
   }
  }
 }
 meeting.updatedAt=new Date().toISOString();
 try{await store.write(catalog.meetings,catalog.etag)}catch{throw new RequestError('عملیات انجام شد ولی ذخیرهٔ فهرست تأیید نشد؛ فهرست، تقویم و Talk را بررسی کن.',502)}
 return json({meeting,warning:meeting.status==='active'?roomWarning(meeting):''});
}

async function appendMeeting(store:ReturnType<typeof meetingStore>,meeting:Meeting){
 for(let attempt=0;attempt<3;attempt++){
  const current=await store.read();if(current.meetings.some(m=>m.id===meeting.id))return;
  try{await store.write([...current.meetings,meeting],current.etag);return}catch(e){if(!(e instanceof Error)||e.message!=='catalog_conflict'||attempt===2)throw e}
 }
}
