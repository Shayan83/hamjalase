export class AIConfigError extends Error {}
export function completionEndpoint(value:string){
 let url:URL;try{url=new URL(value)}catch{throw new AIConfigError('آدرس پایهٔ API معتبر نیست.')}
 const local=['localhost','127.0.0.1','[::1]','host.docker.internal'].includes(url.hostname);
 if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&local)))throw new AIConfigError('آدرس API باید HTTPS باشد؛ HTTP فقط برای مدل محلی پشتیبانی می‌شود. آدرس نباید شامل رمز یا پارامتر باشد.');
 url.pathname=url.pathname.replace(/\/+$/,'');
 if(!url.pathname.endsWith('/chat/completions'))url.pathname+='/chat/completions';
 return url.href;
}
export function resolveAIConfig(data:{apiBaseUrl?:unknown;key?:unknown;model?:unknown},env:Record<string,string|undefined>){
 const custom=typeof data.apiBaseUrl==='string'?data.apiBaseUrl.trim():'';
 const configured=env.AI_BASE_URL?.trim()||'';
 const base=custom||configured;if(!base)throw new AIConfigError('آدرس پایهٔ API را در تنظیمات مدل وارد کن.');
 const endpoint=completionEndpoint(base);
 const sameServer=!custom||(!!configured&&endpoint===completionEndpoint(configured));
 const key=typeof data.key==='string'&&data.key.trim()?data.key.trim():sameServer?env.AI_API_KEY?.trim()||'':'';
 const model=typeof data.model==='string'&&data.model.trim()?data.model.trim():sameServer?env.AI_MODEL?.trim()||'':'';
 if(!model||model.length>200)throw new AIConfigError('نام مدل را در تنظیمات وارد کن.');
 if(/[\r\n]/.test(key))throw new AIConfigError('کلید API معتبر نیست.');
 return {endpoint,key,model};
}
