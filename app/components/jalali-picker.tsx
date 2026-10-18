"use client";
import {useState} from 'react';
const parts=(date:string)=>{const p=new Intl.DateTimeFormat('en-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'}).formatToParts(new Date(date+'T12:00:00Z'));return Object.fromEntries(p.filter(p=>['year','month','day'].includes(p.type)).map(p=>[p.type,Number(p.value)])) as {year:number;month:number;day:number}};
export const persianDate=(date:string)=>new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
const starts=new Map<string,string>();
function gregorian(y:number,m:number,d:number){
 const key=`${y}-${m}`;let first=starts.get(key);
 if(!first){const approx=Date.UTC(y+621,2,20)+(m-1)*30*86400000;for(let i=-12;i<20;i++){const v=new Date(approx+i*86400000).toISOString().slice(0,10),p=parts(v);if(p.year===y&&p.month===m&&p.day===1){first=v;starts.set(key,v);break}}}
 if(!first)throw Error('date');const result=new Date(Date.parse(first+'T12:00:00Z')+(d-1)*86400000).toISOString().slice(0,10),p=parts(result);if(p.year!==y||p.month!==m||p.day!==d)throw Error('date');return result;
}
const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
export default function JalaliPicker({value,onChange,disabled=false}:{value:string;onChange:(v:string)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),[view,setView]=useState(()=>parts(value));
 const first=gregorian(view.year,view.month,1),start=(new Date(first+'T12:00:00Z').getUTCDay()+1)%7;
 const days=Array.from({length:31},(_,i)=>i+1).filter(d=>{try{gregorian(view.year,view.month,d);return true}catch{return false}});
 function move(delta:number){const n=view.month+delta;setView({year:view.year+(n>12?1:n<1?-1:0),month:n>12?1:n<1?12:n,day:1})}
 return <div className="jalali"><button type="button" disabled={disabled} aria-label="انتخاب تاریخ شمسی" onClick={()=>{setView(parts(value));setOpen(!open)}}>{persianDate(value)}</button>{open&&<div className="jalali-panel"><div className="jalali-heading"><button type="button" aria-label="ماه قبل" onClick={()=>move(-1)}>‹</button><b>{months[view.month-1]} {view.year.toLocaleString('fa-IR',{useGrouping:false})}</b><button type="button" aria-label="ماه بعد" onClick={()=>move(1)}>›</button><button type="button" onClick={()=>setOpen(false)}>×</button></div><div className="jalali-grid">{['ش','ی','د','س','چ','پ','ج'].map((v,i)=><small key={i}>{v}</small>)}{Array.from({length:start},(_,i)=><span key={'blank'+i}/>)}{days.map(d=>{const date=gregorian(view.year,view.month,d);return <button type="button" className={date===value?'selected':''} key={d} onClick={()=>{onChange(date);setOpen(false)}}>{d.toLocaleString('fa-IR')}</button>})}</div></div>}</div>
}
