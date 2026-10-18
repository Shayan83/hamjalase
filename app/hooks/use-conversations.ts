"use client";
import {useEffect,useState} from 'react';
import {defaultDraft,type Conversation} from '../lib/client-types';
const fresh=():Conversation=>({id:crypto.randomUUID(),requestId:crypto.randomUUID(),draft:defaultDraft(),messages:[],participants:[],url:''});
export function useConversations(scope:string,onError:(message:string)=>void,legacyKey?:string){
 const [state,setState]=useState<{scope:string;rows:Conversation[]}>({scope:'',rows:[]});
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(scope)||(legacyKey?localStorage.getItem(legacyKey):null)||'[]');const rows=Array.isArray(saved)?saved.filter(r=>r.id&&r.draft&&Array.isArray(r.messages)).slice(0,20).map(r=>({...r,requestId:r.requestId||crypto.randomUUID(),participants:r.participants||[],url:r.url||''})):[];setState({scope,rows:rows.length?rows:[fresh()]})}catch{setState({scope,rows:[fresh()]})}},[scope,legacyKey]);
 useEffect(()=>{if(state.scope!==scope)return;try{localStorage.setItem(scope,JSON.stringify(state.rows))}catch{onError('ذخیرهٔ گفت‌وگو در این مرورگر انجام نشد.')}},[state,scope,onError]);
 const current=state.scope===scope?state.rows[0]:null;
 function update(change:(c:Conversation)=>Conversation){setState(s=>s.scope!==scope||!s.rows[0]?s:{...s,rows:[change(s.rows[0]),...s.rows.slice(1)]})}
 function create(){setState(s=>({scope,rows:[fresh(),...s.rows].slice(0,20)}))}
 function restore(id:string){setState(s=>{const selected=s.rows.find(r=>r.id===id);return selected?{...s,rows:[selected,...s.rows.filter(r=>r.id!==id)]}:s})}
 return {current,history:state.rows,update,create,restore};
}
