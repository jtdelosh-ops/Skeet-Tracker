"use client";
import { useEffect, useState } from "react";

type Invite={id:string;email:string;createdAt:number;expiresAt:number;revokedAt:number|null;redeemedAt:number|null};
type Created={email:string;url:string;code:string;expiresAt:number};
const field={display:"block",width:"100%",border:"1px solid #777",borderRadius:8,padding:12,margin:"8px 0 16px"} as const;
const button={padding:"12px 20px",background:"#174b35",color:"white",borderRadius:8} as const;
export default function Invitations() {
  const [rows,setRows]=useState<Invite[]>([]),[email,setEmail]=useState("");
  const [created,setCreated]=useState<Created|null>(null),[message,setMessage]=useState("");
  const [busy,setBusy]=useState(false),[ready,setReady]=useState(false);
  async function refresh(){const r=await fetch("/api/invitations");const data=await r.json() as {error?:string;invitations:Invite[]};if(!r.ok){setReady(false);throw Error(data.error||"Unable to load invitations.");}setRows(data.invitations);setReady(true);}
  useEffect(()=>{void refresh().catch(e=>setMessage(e.message));},[]);
  async function update(action:"create"|"revoke",id?:string){setBusy(true);setMessage("");try{const r=await fetch("/api/invitations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,email,id})});const data=await r.json() as Created&{error?:string};if(!r.ok)throw Error(data.error||"Unable to update invitation.");if(action==="create"){setCreated(data);setEmail("");}else{setCreated(null);setMessage("Invitation revoked.");}await refresh();}catch(e){setMessage(e instanceof Error?e.message:"Please retry.");}finally{setBusy(false);}}
  async function copy(){if(!created)return;try{await navigator.clipboard.writeText(`You’re invited to Skeet Tracker for ${created.email}. Open ${created.url} and verify this email to create your account. This invitation expires ${new Date(created.expiresAt).toLocaleString()}.`);setMessage("Invitation copied. Share it with the invited shooter.");}catch{setMessage("Copy is unavailable here. Select and copy the invitation link below.");}}
  return <main style={{maxWidth:760,margin:"32px auto",padding:24}}>
    <a href="/" style={{textDecoration:"underline"}}>Back to tracker</a>
    <h1 style={{fontSize:28,fontWeight:700,margin:"20px 0 12px"}}>Invitations</h1>
    <p style={{marginBottom:16,padding:12,border:"1px solid #777",borderRadius:8}}>This test site is currently private to James. Other shooters will need access to the test site before they can open an invitation.</p>
    <p style={{marginBottom:20}}>Invite one shooter per email address. Invitations expire after seven days and work once. Creating another invitation for the same email replaces the previous one.</p>
    {ready&&<form onSubmit={e=>{e.preventDefault();void update("create");}}>
      <label htmlFor="invite-email">Shooter’s email address</label><input id="invite-email" type="email" required maxLength={254} value={email} disabled={busy} onChange={e=>setEmail(e.target.value)} style={field}/>
      <button type="submit" disabled={busy} style={button}>{busy?"Please wait…":"Create invitation"}</button>
    </form>}
    {created&&<section aria-label="New invitation" style={{border:"1px solid #777",borderRadius:12,padding:20,marginTop:24}}>
      <h2 style={{fontSize:20,fontWeight:600}}>Ready to share with {created.email}</h2>
      <p style={{margin:"12px 0"}}>No invitation email has been sent. Copy this link now; it is only shown here once. Expires {new Date(created.expiresAt).toLocaleString()}.</p>
      <label htmlFor="invite-link">Invitation link</label><textarea id="invite-link" readOnly value={created.url} rows={4} style={field}/>
      <button type="button" onClick={()=>void copy()} style={button}>Copy invitation</button>
    </section>}
    <p role="status" style={{marginTop:16}}>{message}</p>
    {!ready&&<button type="button" onClick={()=>void refresh().catch(e=>setMessage(e.message))} style={{padding:12,textDecoration:"underline"}}>Retry loading</button>}
    {ready&&<section style={{marginTop:28}}><h2 style={{fontSize:20,fontWeight:600}}>Recent invitations</h2>
      {!rows.length&&<p style={{marginTop:12}}>No invitations yet.</p>}
      <ul style={{listStyle:"none",padding:0}}>{rows.map(row=>{const status=row.redeemedAt?"Accepted":row.revokedAt?"Revoked":row.expiresAt<=Date.now()?"Expired":"Pending";return <li key={row.id} style={{padding:"16px 0",borderBottom:"1px solid #ccc",overflowWrap:"anywhere"}}><strong>{row.email}</strong><p>{status} · Expires {new Date(row.expiresAt).toLocaleString()}</p>{status==="Pending"&&<button disabled={busy} type="button" onClick={()=>void update("revoke",row.id)} style={{padding:"8px 0",textDecoration:"underline"}}>Revoke invitation</button>}</li>;})}</ul>
    </section>}
  </main>;
}
