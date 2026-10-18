type Person = {user:string;status:'free'|'busy'|'unknown'};
type Span = {start:number;end:number};
const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const decode=(s:string)=>s.replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const tag=(xml:string,name:string)=>decode(new RegExp('<(?:[\\w-]+:)?'+name+'\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?'+name+'>').exec(xml)?.[1]||'');
const instant=(s:string)=>{const m=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s);return m?Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]):NaN};
const overlaps=(spans:Span[],a:number,b:number)=>spans.some(s=>s.start<b&&s.end>a);
export async function checkAvailability(root:string,auth:string,user:string,draft:any,participants:unknown,alwaysSuggest=false,options:{skipOrganizer?:boolean}={}){
 const extra=Array.isArray(participants)?participants.filter((p):p is string=>typeof p==='string'&&!!p):typeof participants==='string'?participants.split(/[,،\s]+/).filter(Boolean):[];
 const users=[...new Set([...(options.skipOrganizer?[]:[user]),...extra])];if(users.length>20||users.some(u=>u.length>100||/[\r\n/]/.test(u)))throw Error('invalid_participants');
 const start=Date.parse(`${draft.date}T${draft.time}:00+03:30`),end=start+Number(draft.duration)*60000;
 if(!Number.isFinite(start)||!Number.isFinite(end))throw Error('invalid_date');
 const from=new Date(`${draft.date}T00:00:00+03:30`),to=new Date(from.getTime()+7*86400000);
 const getUser=async(id:string)=>{
  const path=id===user?'user':`users/${encodeURIComponent(id)}`;
  const r=await fetch(`${root}/ocs/v2.php/cloud/${path}?format=json`,{headers:{Authorization:auth,'OCS-APIRequest':'true'},redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(!r.ok)return null;const v:any=await r.json();const email=v.ocs?.data?.email;
  return typeof email==='string'&&/^[^\s:;]+@[^\s:;]+$/.test(email)?email:null;
 };
 let own:string|null=null;try{own=await getUser(user)}catch{}
 const rows=await Promise.all(users.map(async id=>{
  const unknown={user:id,spans:[] as Span[],known:false};if(!own)return unknown;
  try{
   const email=id===user?own:await getUser(id);if(!email)return unknown;
   const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Hamjalase//FA','METHOD:REQUEST','BEGIN:VFREEBUSY',`UID:${crypto.randomUUID()}`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(from)}`,`DTEND:${stamp(to)}`,`ORGANIZER:mailto:${own}`,`ATTENDEE:mailto:${email}`,'END:VFREEBUSY','END:VCALENDAR',''].join('\r\n');
   const response=await fetch(`${root}/remote.php/dav/calendars/${encodeURIComponent(user)}/outbox/`,{method:'POST',headers:{Authorization:auth,'Content-Type':'text/calendar; charset=utf-8'},redirect:'manual',signal:AbortSignal.timeout(15000),body:ics});
   if(!response.ok)return unknown;const xml=await response.text();
   const blocks=[...xml.matchAll(/<(?:[\w-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?response>/g)];
   const block=blocks.find(b=>tag(b[1],'href').toLowerCase()===`mailto:${email}`.toLowerCase())?.[1];
   if(!block||!tag(block,'request-status').startsWith('2.'))return unknown;
   const calendar=tag(block,'calendar-data').replace(/\r?\n[ \t]/g,'');if(!calendar.includes('BEGIN:VFREEBUSY'))return unknown;
   const spans:Span[]=[];
   for(const line of calendar.split(/\r?\n/)){
    if(!/^FREEBUSY[;:]/.test(line))continue;
    const split=line.indexOf(':');if(/(?:^|;)FBTYPE=FREE(?:;|$)/.test(line.slice(0,split)))continue;
    for(const period of line.slice(split+1).split(',')){
     const [a,b]=period.split('/');const first=instant(a);let last=instant(b||'');
     if(b?.startsWith('P')){const m=/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(b);if(m)last=first+(Number(m[1]||0)*86400+Number(m[2]||0)*3600+Number(m[3]||0)*60+Number(m[4]||0))*1000;}
     if(!Number.isFinite(first)||!Number.isFinite(last)||last<=first)return unknown;spans.push({start:first,end:last});
    }
   }
   return {user:id,spans,known:true};
  }catch{return unknown}
 }));
 const people:Person[]=rows.map(r=>({user:r.user,status:!r.known?'unknown':overlaps(r.spans,start,end)?'busy':'free'}));
 const busy=people.some(p=>p.status==='busy'),unknown=people.some(p=>p.status==='unknown');
 const suggestions:{date:string;time:string}[]=[];
 if((busy||alwaysSuggest)&&!unknown){
  const duration=end-start;
  for(let offset=0;offset<7&&suggestions.length<6;offset++){
   const date=new Date(from.getTime()+offset*86400000+12600000).toISOString().slice(0,10);
   const lower=Date.parse(`${date}T09:00:00+03:30`),upper=Date.parse(`${date}T18:00:00+03:30`);
   let count=0;
   for(let t=lower;t+duration<=upper&&count<2;t+=1800000){if(t<=Date.now()||rows.some(r=>overlaps(r.spans,t,t+duration)))continue;const shifted=new Date(t+12600000).toISOString();suggestions.push({date:shifted.slice(0,10),time:shifted.slice(11,16)});count++}
  }
 }
 return {people,busy,unknown,suggestions,checkedAt:new Date().toISOString()};
}
