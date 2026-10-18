import {dispatchAgent,testModel} from '../../lib/agent-service';
import {connectionFor,RequestError} from '../../lib/connection';
import {localAccess,requestIdentity,sameOrigin} from '../../lib/auth';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 if(!localAccess(request)&&!await requestIdentity(request))return json({error:'برای استفاده وارد حساب شوید.'},401);
 return json({aiConfigured:!!process.env.AI_BASE_URL,hasServerKey:!!process.env.AI_API_KEY,apiBaseUrl:process.env.AI_BASE_URL||'',model:process.env.AI_MODEL||''});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'مبدأ درخواست معتبر نیست.'},403);
 let action='';
 try{
  const raw=await request.text();if(raw.length>60000)return json({error:'درخواست بیش از حد طولانی است.'},400);let data;try{data=JSON.parse(raw)}catch{return json({error:'درخواست معتبر نیست.'},400)}
  if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'درخواست معتبر نیست.'},400);
  action=typeof data.action==='string'?data.action:'';
  const identity=await requestIdentity(request);if(identity&&data.connection?.account!==identity.user)return json({error:'حساب فعال تغییر کرده؛ صفحه را تازه کن.'},409);
  if(data.action==='testModel'){if(!localAccess(request)&&!await requestIdentity(request))return json({error:'برای استفاده وارد حساب شوید.'},401);return await testModel(data)}
  const connection=await connectionFor(request,data.connection);
  return await dispatchAgent(data,connection);
 }catch(e){if(e instanceof RequestError)return json({error:e.message},e.status);console.error('Agent operation failed',action,e instanceof Error?e.message:'unknown');if(action==='testModel')return json({error:'اتصال به API مدل برقرار نشد؛ آدرس، شبکه و زمان پاسخ سرویس را بررسی کن.'},502);if(action==='testNextcloud')return json({error:'اتصال به Nextcloud برقرار نشد؛ آدرس و دسترسی حساب را بررسی کن.'},502);return json({error:'اتصال یا نتیجهٔ عملیات تأیید نشد؛ پیش از تکرار، فهرست جلسه‌ها و Talk را بررسی کن.'},502)}
}
