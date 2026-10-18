"use client";
import {useEffect,useState,type ReactNode} from 'react';
export type Account={user:string;displayName:string;scope?:string};
export default function AuthGate({children}:{children:(account:Account,onLogout:()=>Promise<void>,isLocal:boolean)=>ReactNode}){
 const [state,setState]=useState<{authenticated:boolean;required:boolean;local:boolean;identity:Account|null}|null>(null),[forceLogin,setForceLogin]=useState(false),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function status(){const r=await fetch('/api/auth');if(!r.ok)throw Error('دریافت وضعیت ورود انجام نشد.');setState(await r.json() as any)}
 useEffect(()=>{status().catch(e=>setError(e.message))},[]);
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const d:any=await r.json();if(!r.ok)throw Error(d.error);setPassword('');setForceLogin(false);await status()}catch(e){setError(e instanceof Error?e.message:'ورود انجام نشد.')}finally{setBusy(false)}}
 async function logout(){const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!r.ok)return;setState(null);setForceLogin(true);await status()}
 if(state?.authenticated&&!forceLogin&&state.identity)return children(state.identity,logout,state.local);
 return <main className="login-screen"><section className="login-card"><h1>هم‌جلسه</h1><p>ورود با حساب Nextcloud</p>{!state&&!error?<p role="status">در حال بررسی نشست…</p>:<form onSubmit={login}><label>نام کاربری<input autoComplete="username" dir="ltr" value={username} onChange={e=>setUsername(e.target.value)} required disabled={busy}/></label><label>رمز برنامه<input autoComplete="current-password" type="password" dir="ltr" value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy}/></label>{error&&<p role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'در حال ورود…':'ورود'}</button>{state?.authenticated&&!state.required&&<button type="button" onClick={()=>setForceLogin(false)}>ادامه در فضای محلی</button>}</form>}<small>اطلاعات ورود فقط به Nextcloud تنظیم‌شده روی سرور فرستاده می‌شود.</small></section></main>
}
