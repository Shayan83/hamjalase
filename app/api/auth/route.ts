import {localAccess,requestIdentity,sealSession,sessionCookie,sameOrigin} from '../../lib/auth';
const json=(value:unknown,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
const attempts=new Map<string,{count:number;until:number}>();
export async function GET(request:Request){
 const identity=await requestIdentity(request);
 const account=identity||{user:process.env.NEXTCLOUD_USERNAME||'local',displayName:process.env.NEXTCLOUD_USERNAME||'فضای محلی',root:process.env.NEXTCLOUD_URL||'local'};
 const scope=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(account.root+'#'+account.user))).toString('hex');
 return json({authenticated:!!identity||localAccess(request),required:!localAccess(request),local:!identity&&localAccess(request),identity:identity||localAccess(request)?{user:account.user,displayName:account.displayName,scope}:null});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'مبدأ درخواست معتبر نیست.'},403);
 try{
 const raw=await request.text();if(raw.length>5000)return json({error:'درخواست معتبر نیست.'},400);const data=JSON.parse(raw);
 if(data.action==='logout')return json({ok:true},200,{'Set-Cookie':sessionCookie('',request,true)});
 if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)return json({error:'ورود کاربران هنوز پیکربندی نشده؛ SESSION_SECRET را روی سرور تنظیم کنید.'},503);
 const user=typeof data.username==='string'?data.username.trim():'',password=typeof data.password==='string'?data.password:'';
 if(!user||user.length>100||/[\r\n/:]/.test(user)||!password||password.length>1000)return json({error:'نام کاربری و رمز برنامه را وارد کن.'},400);
 const entry=attempts.get(user);if(entry&&entry.until>Date.now()&&entry.count>=8)return json({error:'تلاش‌های ورود زیاد است؛ چند دقیقه بعد دوباره تلاش کن.'},429);
 const root=(process.env.NEXTCLOUD_URL||'').replace(/\/$/,'');if(!root)return json({error:'آدرس Nextcloud روی سرور تنظیم نشده است.'},503);
 const r=await fetch(root+'/ocs/v2.php/cloud/user?format=json',{headers:{Authorization:`Basic ${Buffer.from(user+':'+password).toString('base64')}`,'OCS-APIRequest':'true'},redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!r.ok){if(attempts.size>1000)attempts.clear();attempts.set(user,{count:entry&&entry.until>Date.now()?entry.count+1:1,until:Date.now()+300000});return json({error:'ورود تأیید نشد؛ نام کاربری و رمز برنامهٔ Nextcloud را بررسی کن.'},401)}
 const body:any=await r.json();const account=body.ocs?.data;if(!account?.id)return json({error:'حساب قابل شناسایی نیست.'},401);
 attempts.delete(user);const identity={user:account.id,password,root,displayName:account.displayname||account.displayName||account.id,expires:Date.now()+28800000};
 return json({authenticated:true,identity:{user:identity.user,displayName:identity.displayName}},200,{'Set-Cookie':sessionCookie(await sealSession(identity,process.env.SESSION_SECRET),request)});
 }catch{return json({error:'اتصال به سرور ورود برقرار نشد.'},503)}
}
