"use client";
import { useEffect,useRef,useState } from "react";
type User={id:string;email:string;displayName:string;role:string;disabled:number;shoots:number};
type Audit={id:string;action:string;entityId:string|null;beforeJson:string|null;afterJson:string|null;createdAt:number;actorName:string;targetName:string;targetEmail:string};
type Data={users:User[];audit:Audit[];total:number;page:number;pages:number};
const actionLabels:Record<string,string>={"shoot.create":"Added a shoot","shoot.update":"Corrected a shoot","shoot.delete":"Deleted a shoot","settings.update":"Changed classification settings","account.disable":"Disabled account access","account.enable":"Restored account access"};
function Snapshot({value}:{value:string|null}) {
  if(!value)return <p>No record</p>;
  const data=JSON.parse(value) as Record<string,unknown>;
  const labels:Record<string,string>={name:"Shoot",date:"Date",status:"Status",notes:"Notes",displayName:"Name",email:"Email",disabled:"Access",'12':"12 gauge",'20':"20 gauge",'28':"28 gauge",'410':".410",doubles:"Doubles"};
  return <div>{Object.entries(data).map(([key,item])=>key==="scores"?<div key={key}><strong>Scores</strong>{(item as Array<Record<string,unknown>>).map((score,i)=><p key={i}>{String(score.event)} · {String(score.label)} · {String(score.broken)}/{String(score.targets)} · Class {String(score.class??"—")} · {String(score.date??"—")}</p>)}</div>:<p key={key}><strong>{labels[key]??key}: </strong>{key==="disabled"?(item?"Disabled":"Active"):String(item??"—")}</p>)}</div>;
}
export default function Admin(){
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[filter,setFilter]=useState("");
  const requestNumber=useRef(0);
  async function load(page=1,user=filter){const current=++requestNumber.current;setError("");try{const r=await fetch(`/api/admin?page=${page}&user=${encodeURIComponent(user)}`);const d=await r.json() as Data&{error?:string};if(!r.ok)throw Error(d.error||"Unable to load administration.");if(current===requestNumber.current)setData(d);}catch(e){if(current===requestNumber.current)setError(e instanceof Error?e.message:"Unable to load administration.");}}
  useEffect(()=>{void load(1,"");},[]);
  async function access(user:User){const action=user.disabled?"enable":"disable";if(!window.confirm(`${user.disabled?"Restore":"Disable"} access for ${user.displayName} (${user.email})? ${user.disabled?"They will need to sign in again.":"Their active sessions will end. Their records will be preserved."}`))return;setBusy(true);setError("");try{const r=await fetch("/api/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,userId:user.id})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||"Unable to change access.");await load(data?.page??1);}catch(e){setError(e instanceof Error?e.message:"Unable to change access.");}finally{setBusy(false);}}
  return <main style={{maxWidth:1000,margin:"32px auto",padding:24}}>
    <nav><a href="/" style={{textDecoration:"underline"}}>My tracker</a> · <a href="/invitations" style={{textDecoration:"underline"}}>Invitations</a></nav>
    <h1 style={{fontSize:28,fontWeight:700,margin:"20px 0 12px"}}>Administration</h1>
    <p>Choose a shooter to help with their records. Disabling access preserves their records and signs them out.</p>
    {error&&<p role="alert" style={{marginTop:16}}>{error} <button onClick={()=>void load()} style={{textDecoration:"underline"}}>Retry</button></p>}
    {!data&&!error&&<p role="status">Loading accounts…</p>}
    {data&&<><section style={{marginTop:24}}><h2 style={{fontSize:22,fontWeight:600}}>Accounts</h2>
      <ul style={{listStyle:"none",padding:0}}>{data.users.map(user=><li key={user.id} style={{borderBottom:"1px solid #ccc",padding:"18px 0",overflowWrap:"anywhere"}}><strong>{user.displayName}</strong><p>{user.email}</p><p>{user.role==="admin"?"Administrator":user.disabled?"Disabled":"Active"} · {user.shoots} shoots</p>{user.role==="shooter"&&<div style={{display:"flex",gap:20,flexWrap:"wrap",marginTop:8}}><a href={`/?shooter=${encodeURIComponent(user.id)}`} style={{textDecoration:"underline"}}>Help with records</a><button disabled={busy} onClick={()=>void access(user)} style={{textDecoration:"underline"}}>{user.disabled?"Restore access":"Disable access"}</button></div>}</li>)}</ul>
    </section><section style={{marginTop:32}}><h2 style={{fontSize:22,fontWeight:600}}>Administrative history</h2><p>Who changed a shooter’s records or account access, with the values before and after.</p>
      <label htmlFor="audit-user" style={{display:"block",marginTop:16}}>Shooter</label><select id="audit-user" value={filter} disabled={busy} onChange={e=>{setFilter(e.target.value);void load(1,e.target.value);}} style={{padding:10,border:"1px solid #777",borderRadius:8,maxWidth:"100%"}}><option value="">All shooters</option>{data.users.filter(u=>u.role==="shooter").map(u=><option key={u.id} value={u.id}>{u.displayName} · {u.email}</option>)}</select>
      {!data.audit.length&&<p style={{marginTop:16}}>No administrative changes recorded.</p>}
      {data.audit.map(entry=><article key={entry.id} style={{borderBottom:"1px solid #ccc",padding:"18px 0",overflowWrap:"anywhere"}}><strong>{actionLabels[entry.action]??entry.action}</strong><p>{entry.actorName} · {entry.targetName} ({entry.targetEmail})</p><p>{new Date(entry.createdAt).toLocaleString()}{entry.entityId?` · Shoot #${entry.entityId}`:""}</p><details style={{marginTop:8}}><summary style={{cursor:"pointer"}}>View changes</summary><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,260px),1fr))",gap:20,paddingTop:12}}><div><h3 style={{fontWeight:600,marginBottom:8}}>Before</h3><Snapshot value={entry.beforeJson}/></div><div><h3 style={{fontWeight:600,marginBottom:8}}>After</h3><Snapshot value={entry.afterJson}/></div></div></details></article>)}
      <div style={{display:"flex",gap:16,marginTop:20,alignItems:"center"}}><button disabled={busy||data.page<=1} onClick={()=>void load(data.page-1)}>Previous</button><span>Page {data.page} of {data.pages} · {data.total} changes</span><button disabled={busy||data.page>=data.pages} onClick={()=>void load(data.page+1)}>Next</button></div>
    </section></>}
  </main>;
}
