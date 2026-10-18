export type Identity={user:string;password:string;displayName:string;root:string;expires:number};
const cookieName='hamjalase_session';
const encode=(v:Uint8Array)=>Buffer.from(v).toString('base64url');
const decode=(v:string)=>new Uint8Array(Buffer.from(v,'base64url'));
async function encryptionKey(secret:string){
 if(secret.length<32)throw Error('SESSION_SECRET must have at least 32 characters');
 return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function sealSession(identity:Identity,secret:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(cookieName)},await encryptionKey(secret),new TextEncoder().encode(JSON.stringify(identity)));
 return encode(iv)+'.'+encode(new Uint8Array(encrypted));
}
export async function openSession(token:string,secret:string,now=Date.now()):Promise<Identity|null>{
 try{const [iv,data,...extra]=token.split('.');if(extra.length||!iv||!data)return null;
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:new TextEncoder().encode(cookieName)},await encryptionKey(secret),decode(data));
 const v=JSON.parse(new TextDecoder().decode(plain));
 return typeof v.user==='string'&&typeof v.password==='string'&&typeof v.root==='string'&&v.expires>now?v:null;
 }catch{return null}
}
export function localAccess(request:Request){return process.env.APP_AUTH_REQUIRED!=='true'&&process.env.NODE_ENV==='development'&&['127.0.0.1','localhost'].includes(new URL(request.url).hostname)}
export function sessionCookie(value:string,request:Request,clear=false){return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:28800}${(new URL(request.url).protocol==='https:'||(process.env.APP_AUTH_REQUIRED==='true'&&!['localhost','127.0.0.1'].includes(new URL(request.url).hostname)))?'; Secure':''}`}
export async function requestIdentity(request:Request){
 const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(token&&process.env.SESSION_SECRET){const v=await openSession(token,process.env.SESSION_SECRET);if(v&&v.root===process.env.NEXTCLOUD_URL?.replace(/\/$/,''))return v;}
 return null;
}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin}
