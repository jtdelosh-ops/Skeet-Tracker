"use client";
import { useEffect, useState } from "react";

type EmailStatus="not_sent"|"sending"|"sent"|"failed"|"unknown";
type Invite={id:string;email:string;createdAt:number;expiresAt:number;revokedAt:number|null;redeemedAt:number|null;emailStatus:EmailStatus;sentAt:number|null};
type Created={email:string;url:string;code:string;expiresAt:number;emailStatus:EmailStatus};
const field={display:"block",width:"100%",border:"1px solid #777",borderRadius:8,padding:12,margin:"8px 0 16px"} as const;
const button={padding:"12px 20px",background:"#174b35",color:"white",borderRadius:8} as const;
export default function Invitations() {
  const [rows,setRows]=useState<Invite[]>([]),[email,setEmail]=useState("");
  const [created,setCreated]=useState<Created|null>(null),[message,setMessage]=useState("");
  const [busy,setBusy]=useState(false),[ready,setReady]=useState(false);
  async function refresh(){const r=await fetch("/api/invitations");const data=await r.json() as {error?:string;invitations:Invite[]};if(!r.ok){setReady(false);throw Error(data.error||"Unable to load invitations.");}setRows(data.invitations);setReady(true);}
  useEffect(()=>{void refresh().catch(e=>setMessage(e.message));},[]);
  async function update(action:"create"|"send"|"revoke",id?:string){if(busy)return;setBusy(true);setMessage("");try{const r=await fetch("/api/invitations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,email,id})});const data=await r.json() as Created&{error?:string};if(!r.ok)throw Error(data.error||"Unable to update invitation.");if(action!=="revoke"){setCreated(data);setEmail("");}else{setCreated(null);setMessage("Invitation revoked.");}await refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to confirm the result. Refresh the invitation list before trying again.");}finally{setBusy(false);}}
  async function copy(){if(!created)return;try{await navigator.clipboard.writeText(created.url);setMessage("Link copied.");}catch{setMessage("Copy is unavailable here. Select and copy the invitation link below.");}}
  return <main style={{maxWidth:760,margin:"32px auto",padding:24}}>
    <a href="/" style={{textDecoration:"underline"}}>Back to tracker</a>
    <h1 style={{fontSize:28,fontWeight:700,margin:"20px 0 12px"}}>Invitations</h1>
    <p style={{marginBottom:16,padding:12,border:"1px solid #777",borderRadius:8}}>This test site is currently private to James. Other shooters will need access to the test site before they can open an invitation.</p>
    <p style={{marginBottom:20}}>Enter a shooter’s email and send their invitation directly. It expires after seven days and works once. Sending or creating another invitation for the same email replaces the previous one.</p>
    {ready&&<form onSubmit={e=>{e.preventDefault();const submitter=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;void update(submitter?.value==="create"?"create":"send");}}>
      <label htmlFor="invite-email">Shooter’s email address</label><input id="invite-email" type="email" required maxLength={254} value={email} disabled={busy} onChange={e=>setEmail(e.target.value)} style={field}/>
      <button type="submit" value="send" disabled={busy} style={button}>{busy?"Please wait…":"Send invitation"}</button>
      <button type="submit" value="create" disabled={busy} style={{padding:12,textDecoration:"underline"}}>Create link only</button>
    </form>}
    {created&&<section aria-label="New invitation" style={{border:"1px solid #777",borderRadius:12,padding:20,marginTop:24}}>
      <h2 style={{fontSize:20,fontWeight:600}}>{created.emailStatus==="sent"?"Invitation sent":created.emailStatus==="not_sent"?"Invitation link ready":created.emailStatus==="failed"?"Email could not be sent":"Email sending could not be confirmed"}</h2>
      <p style={{margin:"12px 0"}}>{created.emailStatus==="sent"?`The email service accepted the invitation for ${created.email}. Ask them to check their inbox and spam folder.`:created.emailStatus==="not_sent"?`No email was sent to ${created.email}. Copy the link below to share it yourself.`:created.emailStatus==="failed"?`The invitation for ${created.email} is still valid. Copy its link below, or enter the email again to send a replacement.`:`The invitation for ${created.email} is still valid, but we cannot confirm whether the email was sent. Check their inbox before sending a replacement, or copy the link below.`}</p>
      <p style={{marginBottom:12}}>Expires {new Date(created.expiresAt).toLocaleString()}. This link is shown here only once.</p>
      <label htmlFor="invite-link">Invitation link</label><textarea id="invite-link" readOnly value={created.url} rows={4} style={field}/>
      <button type="button" onClick={()=>void copy()} style={button}>Copy link only</button>
    </section>}
    <p role="status" style={{marginTop:16}}>{message}</p>
    {!ready&&<button type="button" onClick={()=>void refresh().catch(e=>setMessage(e.message))} style={{padding:12,textDecoration:"underline"}}>Retry loading</button>}
    {ready&&<section style={{marginTop:28}}><h2 style={{fontSize:20,fontWeight:600}}>Recent invitations</h2>
      {!rows.length&&<p style={{marginTop:12}}>No invitations yet.</p>}
      <ul style={{listStyle:"none",padding:0}}>{rows.map(row=>{const status=row.redeemedAt?"Accepted":row.revokedAt?"Revoked":row.expiresAt<=Date.now()?"Expired":"Pending";const mail=row.emailStatus==="sent"?"Email sent":row.emailStatus==="failed"?"Email not sent":row.emailStatus==="not_sent"?"Link only":"Email sending unconfirmed";return <li key={row.id} style={{padding:"16px 0",borderBottom:"1px solid #ccc",overflowWrap:"anywhere"}}><strong>{row.email}</strong><p>{status} · {mail} · Expires {new Date(row.expiresAt).toLocaleString()}</p>{status==="Pending"&&<button disabled={busy} type="button" onClick={()=>void update("revoke",row.id)} style={{padding:"8px 0",textDecoration:"underline"}}>Revoke invitation</button>}</li>;})}</ul>
    </section>}
  </main>;
}
