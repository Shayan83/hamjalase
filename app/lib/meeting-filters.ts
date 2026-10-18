import type {Meeting} from './meetings.ts';
export type MeetingFilter='all'|'upcoming'|'past'|'cancelled';
export function filterMeetings(meetings:Meeting[],query:string,filter:MeetingFilter,now=Date.now()){
 const normalize=(s:string)=>s.toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/\u200c/g,' ').trim();
 const q=normalize(query);
 return meetings.filter(m=>{
  const end=Date.parse(`${m.draft.date}T${m.draft.time}:00+03:30`)+m.draft.duration*60000;
  const fits=filter==='all'||(filter==='cancelled'?m.status==='cancelled':m.status==='active'&&(filter==='upcoming'?end>=now:end<now));
  return fits&&(!q||normalize([m.draft.title,m.draft.agenda,m.draft.date,...m.participants].join(' ')).includes(q));
 }).sort((a,b)=>Date.parse(`${a.draft.date}T${a.draft.time}:00+03:30`)-Date.parse(`${b.draft.date}T${b.draft.time}:00+03:30`));
}
