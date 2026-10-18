import {RequestError} from './connection.ts';
export async function requestFingerprint(draft:any,participants:string[]){return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([[draft.title,draft.date,draft.time,Number(draft.duration),draft.agenda],[...participants].sort()] )))).toString('hex')}
export function creationGuard(root:string,auth:string,user:string,key:string){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key))throw new RequestError('شناسهٔ ساخت معتبر نیست؛ صفحه را تازه کن.');
 const path=`${root}/remote.php/dav/files/${encodeURIComponent(user)}/Hamjalase-request-${key}.json`;
 const headers={Authorization:auth,'Content-Type':'application/json'};
 return {
 async existing(fingerprint:string){const r=await fetch(path,{headers,redirect:'manual',signal:AbortSignal.timeout(12000)});if(r.status===404)return null;if(!r.ok)throw new RequestError('وضعیت درخواست قبلی قابل بررسی نیست؛ دوباره جلسه نساز.',503);const value:any=await r.json();if(value.fingerprint!==fingerprint)throw new RequestError('این شناسه برای مشخصات دیگری استفاده شده است.',409);if(value.response)return value.response;throw new RequestError('درخواست قبلی هنوز کامل تأیید نشده است. پیش از ساخت دوباره، فهرست جلسه‌ها و Talk را بررسی کن.',409)},
 async reserve(fingerprint:string){const r=await fetch(path,{method:'PUT',headers:{...headers,'If-None-Match':'*'},redirect:'manual',signal:AbortSignal.timeout(12000),body:JSON.stringify({fingerprint,createdAt:new Date().toISOString(),state:'pending'})});if(!r.ok)throw new RequestError(r.status===412?'درخواست مشابه در حال انجام است؛ چند لحظه بعد دوباره تلاش کن.':'ثبت درخواست انجام نشد؛ جلسه ساخته نشد.',r.status===412?409:503);return r.headers.get('etag')},
 async complete(fingerprint:string,response:unknown,etag:string|null){if(!etag)throw Error('reservation_etag_missing');const r=await fetch(path,{method:'PUT',headers:{...headers,'If-Match':etag},redirect:'manual',signal:AbortSignal.timeout(12000),body:JSON.stringify({fingerprint,state:'complete',response})});if(!r.ok)throw Error('reservation_finalize_failed')}
 };
}
