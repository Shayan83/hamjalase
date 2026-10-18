export type MeetingDraft = {title:string;date:string;time:string;duration:number;agenda:string};
export function draftValid(d:any):d is MeetingDraft {
 const date=typeof d?.date==='string'?new Date(d.date+'T12:00:00Z'):null;
 if(!date||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==d.date)return false;
 return !!(d&&typeof d.title==='string'&&d.title.trim()&&d.title.length<=200&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time)&&[15,30,45,60].includes(Number(d.duration))&&typeof d.agenda==='string'&&d.agenda.length<=4000);
}
