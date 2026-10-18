export async function listUsers(root:string,auth:string,user:string,query:string){
 const get=async(path:string)=>{const r=await fetch(root+path,{headers:{Authorization:auth,'OCS-APIRequest':'true',Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(12000)});if(!r.ok)return null;const v:any=await r.json();return [100,200].includes(v.ocs?.meta?.statuscode)?v.ocs.data:null;};
 const self=await get('/ocs/v2.php/cloud/user?format=json');if(!self)throw Error('directory_access');
 const currentUser={id:user,displayName:self.displayname||self.displayName||user};
 const q=encodeURIComponent(query.slice(0,100));
 const details=await get(`/ocs/v2.php/cloud/users/details?format=json&limit=50&search=${q}`);
 let users:{id:string;displayName:string}[]=[];
 if(details?.users&&typeof details.users==='object'&&!Array.isArray(details.users)){
  users=Object.entries(details.users).filter(([,v]:any)=>v&&v.enabled!==false&&v.enabled!=='false').map(([id,v]:any)=>({id,displayName:v.displayname||v.displayName||id}));
 }else{
  const shared=await get(`/ocs/v2.php/apps/files_sharing/api/v1/sharees?format=json&search=${q}&itemType=calendar&perPage=50&lookup=false&shareType%5B%5D=0`);
  if(!shared)throw Error('directory_access');
  users=[...(shared.exact?.users||[]),...(shared.users||[])].filter((v:any)=>typeof v.value?.shareWith==='string').map((v:any)=>({id:v.value.shareWith,displayName:v.label||v.value.shareWith}));
 }
 users=[...new Map(users.filter(u=>typeof u.id==='string'&&typeof u.displayName==='string').map(u=>[u.id,u])).values()];
 return {currentUser,users:users.filter(u=>u.id!==user)};
}
