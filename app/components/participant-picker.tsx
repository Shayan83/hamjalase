"use client";
import {useEffect,useState} from 'react';
export type DirectoryUser={id:string;displayName:string};
type Props={connection:{url:string;username:string;password:string};selected:DirectoryUser[];onChange:(users:DirectoryUser[])=>void;disabled:boolean};
export default function ParticipantPicker({connection,selected,onChange,disabled}:Props){
 const [query,setQuery]=useState(''),[users,setUsers]=useState<DirectoryUser[]>([]),[self,setSelf]=useState<DirectoryUser|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');
  const timer=setTimeout(async()=>{try{
   const response=await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'users',connection,query}),signal:controller.signal});
   const data:any=await response.json();if(!response.ok)throw Error(data.error||'فهرست کاربران دریافت نشد.');
   setUsers(data.users);setSelf(data.currentUser);
  }catch(e){if(!controller.signal.aborted){setUsers([]);setError(e instanceof Error?e.message:'فهرست کاربران دریافت نشد.')}}finally{if(!controller.signal.aborted)setLoading(false)}},200);
  return()=>{clearTimeout(timer);controller.abort()};
 },[query,connection.url,connection.username,connection.password,retry]);
 const toggle=(user:DirectoryUser)=>onChange(selected.some(p=>p.id===user.id)?selected.filter(p=>p.id!==user.id):[...selected,user]);
 return <section className="participant-picker" aria-label="انتخاب شرکت‌کننده‌ها"><div className="picker-label">شرکت‌کننده‌ها</div>
 <div className="participant-chips">{self&&<span className="participant-chip fixed">{self.displayName} <small>شما · سازمان‌دهنده</small></span>}{selected.map(p=><span className="participant-chip" key={p.id}>{p.displayName}<button disabled={disabled} aria-label={`حذف ${p.displayName}`} onClick={()=>toggle(p)}>×</button></span>)}</div>
 <details><summary>انتخاب کاربران {selected.length>0&&`(${selected.length.toLocaleString('fa-IR')})`}</summary><div className="picker-panel"><input aria-label="جست‌وجوی کاربران" placeholder="جست‌وجوی نام افراد…" value={query} onChange={e=>setQuery(e.target.value)} disabled={disabled}/>
 {loading?<p className="help" role="status">در حال دریافت کاربران…</p>:error?<div className="picker-error" role="alert">{error}<button onClick={()=>setRetry(n=>n+1)}>تلاش دوباره</button></div>:<div className="picker-options">{self&&<label className="picker-option"><input type="checkbox" checked disabled/><span>{self.displayName}<small>سازمان‌دهنده · همیشه انتخاب شده</small></span></label>}{users.map(p=><label className="picker-option" key={p.id}><input type="checkbox" checked={selected.some(s=>s.id===p.id)} disabled={disabled||(!selected.some(s=>s.id===p.id)&&selected.length>=19)} onChange={()=>toggle(p)}/><span>{p.displayName}<small dir="auto">{p.id}</small></span></label>)}{!users.length&&<p className="help">{query?'کاربری با این نام پیدا نشد.':'فعلاً کاربر دیگری برای انتخاب وجود ندارد.'}</p>}</div>}</div></details>
 <p className="help">تقویم افراد بررسی می‌شود و پس از ساخت، عضو اتاق Talk می‌شوند.</p></section>;
}
