"use client";
import {useState} from 'react';
import JalaliPicker from './jalali-picker';
import ParticipantPicker from './participant-picker';
import type {Meeting} from '../lib/meetings';
import type {ConnectionInput} from '../lib/client-types';
export default function MeetingEditor({meeting,connection,busy,onSave,onClose}:{meeting:Meeting;connection:ConnectionInput;busy:boolean;onSave:(draft:Meeting['draft'],participants:string[])=>void;onClose:()=>void}){
 const [draft,setDraft]=useState({...meeting.draft}),[people,setPeople]=useState(meeting.participants.map(id=>({id,displayName:id})));
 const edit=(name:string,value:string|number)=>setDraft(d=>({...d,[name]:value}));
 return <section className="meeting-editor" aria-label="ویرایش کامل جلسه"><label>عنوان<input value={draft.title} maxLength={200} disabled={busy} onChange={e=>edit('title',e.target.value)}/></label><div className="fields"><label>تاریخ<JalaliPicker value={draft.date} disabled={busy} onChange={date=>edit('date',date)}/></label><label>ساعت<input type="time" value={draft.time} disabled={busy} onChange={e=>edit('time',e.target.value)}/></label></div><label>مدت<select value={draft.duration} disabled={busy} onChange={e=>edit('duration',Number(e.target.value))}>{[15,30,45,60].map(n=><option key={n} value={n}>{n} دقیقه</option>)}</select></label><label>دستور جلسه<textarea value={draft.agenda} maxLength={4000} disabled={busy} onChange={e=>edit('agenda',e.target.value)}/></label><ParticipantPicker connection={connection} selected={people} onChange={setPeople} disabled={busy}/><p className="help">زمان جدید و تقویم افراد بررسی می‌شوند؛ بازهٔ قبلی همین جلسه دوباره تداخل شمرده نمی‌شود. افراد حذف‌شده دسترسی عضویت اتاق را از دست می‌دهند؛ لینک عمومی همچنان امکان ورود مهمان دارد.</p><button disabled={busy} onClick={()=>onSave(draft,people.map(p=>p.id))}>{busy?'در حال ذخیره…':'بررسی و ذخیره تغییرات'}</button><button disabled={busy} onClick={onClose}>انصراف</button></section>
}
