import {localAccess,requestIdentity} from './auth.ts';
export class RequestError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status}}
export async function connectionFor(request:Request,override?:{account?:string;url?:string;username?:string;password?:string}){
 const identity=await requestIdentity(request);
 if(identity){if(override?.account!==identity.user)throw new RequestError('حساب فعال در برگهٔ دیگری تغییر کرده؛ صفحه را تازه کن.',409);if(override?.url?.trim())throw new RequestError('در نشست کاربری، اتصال به حساب واردشده محدود است.',403);return {root:identity.root,user:identity.user,auth:`Basic ${Buffer.from(identity.user+':'+identity.password).toString('base64')}`,browserRoot:(process.env.NEXTCLOUD_BROWSER_URL||identity.root).replace(/\/$/,'')};}
 if(!localAccess(request))throw new RequestError('برای استفاده وارد حساب Nextcloud شوید.',401);
 const supplied=!!override?.url?.trim();let base:URL;
 try{base=new URL(supplied?override!.url!.trim():process.env.NEXTCLOUD_URL||'http://invalid.local')}catch{throw new RequestError('آدرس Nextcloud معتبر نیست.')}
 if(supplied&&(base.protocol!=='https:'||!base.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(base.hostname)||base.hostname.endsWith('.local')||base.username||base.password))throw new RequestError('آدرس سرور باید عمومی و HTTPS باشد.');
 const user=supplied?override?.username:process.env.NEXTCLOUD_USERNAME,password=supplied?override?.password:process.env.NEXTCLOUD_PASSWORD;
 if(!user||!password)throw new RequestError('مشخصات اتصال Nextcloud تنظیم نشده است.');
 base.search='';base.hash='';const root=base.href.replace(/\/$/,'');
 return {root,user,auth:`Basic ${Buffer.from(user+':'+password).toString('base64')}`,browserRoot:(!supplied&&process.env.NEXTCLOUD_BROWSER_URL?process.env.NEXTCLOUD_BROWSER_URL:root).replace(/\/$/,'')};
}
