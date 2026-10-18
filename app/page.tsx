"use client";
import {useEffect,useState} from 'react';
import {X} from 'lucide-react';
import AuthGate,{type Account} from './components/auth-gate';
import WorkspaceSidebar from './components/workspace-sidebar';
import ChatPanel from './components/chat-panel';
import DraftPanel from './components/meeting-draft';
import SettingsDialog,{type AISettings} from './components/settings-dialog';
import {useConversations} from './hooks/use-conversations';
import type {ConnectionInput,Message} from './lib/client-types';
import type {MeetingDraft} from './lib/chat-result';
import type {Meeting} from './lib/meetings';
import type {DirectoryUser} from './components/participant-picker';
const emptyConnection:ConnectionInput={account:'',url:'',username:'',password:''};
export default function Home(){return <AuthGate>{(account,onLogout,isLocal)=><Workspace key={account.scope||account.user} account={account} onLogout={onLogout} isLocal={isLocal}/>}</AuthGate>}
function Workspace({account,onLogout,isLocal}:{account:Account;onLogout:()=>Promise<void>;isLocal:boolean}){
 const [notice,setNotice]=useState(''),[settings,setSettings]=useState(false),[busy,setBusy]=useState(false),[creating,setCreating]=useState(false),[checking,setChecking]=useState(false),[input,setInput]=useState('');
 const [connection,setConnection]=useState<ConnectionInput>({...emptyConnection,account:account.user}),[ai,setAI]=useState<AISettings>({apiBaseUrl:'',key:'',model:''});
 const [server,setServer]=useState({aiConfigured:false,hasServerKey:false,model:''}),[revision,setRevision]=useState(0),[availabilityState,setAvailabilityState]=useState<any>(null);
 const scope='hamjalase:v2:'+(account.scope||account.user)+':'+connection.url+':'+connection.username;
 const {current,history,update,create:newConversation,restore}=useConversations(scope,setNotice,isLocal?'hamjalase:v1:'+connection.url+':'+connection.username:undefined);
 useEffect(()=>{fetch('/api/agent').then(r=>r.json()).then((d:any)=>setServer(d)).catch(()=>{})},[]);
 if(!current)return <main className="loading-screen">در حال بازیابی گفت‌وگو…</main>;
 const {draft,messages,participants,url}=current;
 const signature=JSON.stringify([draft.date,draft.time,draft.duration,participants,connection]);
 const availability=availabilityState?.signature===signature?availabilityState.report:null;
 const organizer=connection.url?connection.username:account.user;
 const api=async(data:object)=>{const r=await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({connection,...data})});const value:any=await r.json();return {r,value}};
 function edit(name:keyof MeetingDraft,value:string|number){update(c=>({...c,draft:{...c.draft,[name]:value},requestId:crypto.randomUUID(),url:''}))}
 function selectPeople(people:DirectoryUser[]){update(c=>({...c,participants:people,requestId:crypto.randomUUID(),url:''}))}
 async function check(suggest=false){
  if(checking||creating)return;setChecking(true);setNotice('');
  try{const {r,value}=await api({action:suggest?'suggest':'availability',draft,participants:participants.map(p=>p.id)});if(!r.ok)throw Error(value.error);setAvailabilityState({signature,report:value.availability})}catch(e){setNotice(e instanceof Error?e.message:'بررسی تقویم انجام نشد.')}finally{setChecking(false)}
 }
 async function send(text=input){
  if(!text.trim()||busy||creating)return;
  const next:Message[]=[...messages,{role:'user',content:text}];update(c=>({...c,messages:next}));setInput('');
  if(!ai.apiBaseUrl.trim()&&!server.aiConfigured){setSettings(true);setNotice('اتصال مدل را در تنظیمات مشخص کن.');return}
  setBusy(true);setNotice('');
  try{const {r,value}=await api({action:'chat',...ai,messages:next.slice(-20).map(m=>({role:m.role,content:m.content})),draft,participants:participants.map(p=>p.id)});if(!r.ok)throw Error(value.error);
   update(c=>({...c,messages:[...next,{role:'assistant',content:value.reply,confirm:value.requiresConfirmation===true,proposal:value.proposal,meetings:value.meetings}],...(value.draft?{draft:value.draft,url:'',requestId:crypto.randomUUID()}:{})}));
   if(value.availability)setAvailabilityState({signature:JSON.stringify([value.draft.date,value.draft.time,value.draft.duration,participants,connection]),report:value.availability});
  }catch(e){const error=e instanceof Error?e.message:'پاسخ دریافت نشد.';setNotice(error);update(c=>({...c,messages:[...c.messages,{role:'assistant',content:error}]}))}finally{setBusy(false)}
 }
 async function createMeeting(){
  if(creating||busy||url)return;setCreating(true);setNotice('');
  try{const {r,value}=await api({action:'meeting',requestId:current!.requestId,draft,participants:participants.map(p=>p.id)});if(value.availability)setAvailabilityState({signature,report:value.availability});if(!r.ok)throw Error(value.error);
   if(typeof value.url!=='string'||!/^https?:\/\//.test(value.url))throw Error('ساخت جلسه بدون لینک معتبر تأیید نشد.');
   update(c=>({...c,url:value.url,messages:[...c.messages,{role:'assistant',content:`${value.calendarSaved?'جلسه در Talk و تقویم ساخته شد.':'اتاق Talk ساخته شد؛ ثبت تقویم کامل نشد.'}${value.replayed?' نتیجهٔ همان درخواست قبلی بازیابی شد.':''}${value.local?' لینک فعلاً فقط روی این دستگاه قابل دسترسی است.':''}`,url:value.url}]}));setRevision(n=>n+1);setNotice(value.warning||'لینک جلسه آماده است.');
  }catch(e){const error=e instanceof Error?e.message:'نتیجهٔ ساخت تأیید نشد.';setNotice(error);update(c=>({...c,messages:[...c.messages,{role:'assistant',content:error}]}))}finally{setCreating(false)}
 }
 async function confirmProposal(index:number){
  const proposal=messages[index]?.proposal;if(!proposal||messages[index].resolved||creating||busy)return;setCreating(true);setNotice('');const outcomes:string[]=[];
  for(const m of proposal.meetings){try{const {r,value}=await api({action:proposal.kind,id:m.id,draft:proposal.draft,expected:m});if(!r.ok)throw Error(value.error);outcomes.push(`✓ «${m.draft.title}»: ${proposal.kind==='cancel'?'رویداد و اتاق Talk حذف شدند.':`زمان به ${value.meeting.draft.date} ساعت ${value.meeting.draft.time} تغییر کرد.`}`);meetingChanged(value.meeting)}catch(e){outcomes.push(`✗ «${m.draft.title}»: ${e instanceof Error?e.message:'عملیات تأیید نشد.'}`)}}
  update(c=>({...c,messages:[...c.messages.map((m,i)=>i===index?{...m,resolved:true}:m),{role:'assistant',content:outcomes.join('\n')}]}));setRevision(n=>n+1);setCreating(false);
 }
 function meetingChanged(m:Meeting){update(c=>m.url===c.url?{...c,url:m.status==='cancelled'?'':c.url,requestId:m.status==='cancelled'?crypto.randomUUID():c.requestId,draft:m.status==='cancelled'?c.draft:m.draft}:c)}
 async function copy(text:string){try{await navigator.clipboard.writeText(text);setNotice('کپی شد.')}catch{setNotice('متن را انتخاب و کپی کن.')}}
 return <main><WorkspaceSidebar account={account} history={history} disabled={busy||creating} onNew={()=>{newConversation();setInput('');setNotice('')}} onRestore={id=>{restore(id);setInput('')}} onSettings={()=>setSettings(true)} onLogout={onLogout}/><section className="workspace"><header><div><b>دستیار جلسه</b><span> / {messages.length?draft.title:'گفت‌وگوی جدید'}</span></div><button className="status" onClick={()=>setSettings(true)}><i/>Nextcloud و مدل هوشمند</button></header><div className="grid"><ChatPanel messages={messages} input={input} onInput={setInput} onSend={send} busy={busy} creating={creating} onCreate={createMeeting} onConfirm={confirmProposal} onDecline={index=>update(c=>({...c,messages:[...c.messages.map((m,i)=>i===index?{...m,resolved:true}:m),{role:'assistant',content:'انصراف ثبت شد؛ تغییری انجام نشد.'}]}))} onCopy={copy} onSettings={()=>setSettings(true)} configured={!!ai.apiBaseUrl||server.aiConfigured}/><DraftPanel draft={draft} onEdit={edit} participants={participants} onParticipants={selectPeople} connection={connection} creating={creating} busy={busy} checking={checking} availability={availability} onCheck={()=>check()} onSuggest={()=>check(true)} onCreate={createMeeting} onCopy={copy} url={url} revision={revision} organizer={organizer} onNotice={setNotice} onChanged={meetingChanged}/></div></section>{notice&&<div className="notice" role="status">{notice}<button aria-label="بستن پیام" onClick={()=>setNotice('')}><X size={16}/></button></div>}{settings&&<SettingsDialog ai={ai} onAI={setAI} connection={connection} onConnection={setConnection} serverConfigured={server.aiConfigured} serverHasKey={server.hasServerKey} serverModel={server.model} isLocal={isLocal} onClose={()=>setSettings(false)}/>}</main>
}
