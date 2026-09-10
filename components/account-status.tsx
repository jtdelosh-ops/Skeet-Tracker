"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { trackerFetch } from "@/lib/tracker-fetch";
type Profile={displayName:string;email:string;role:string;legacy:null|{shoots:number;settings:number};support:null|{displayName:string;email:string}};
export function AccountStatus() {
  const path=usePathname();
  const [profile,setProfile]=useState<Profile|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{if(path!=="/") return;let alive=true;void trackerFetch("/api/account").then(async r=>{if(!r.ok) throw Error("Unable to load account.");return r.json() as Promise<Profile>;}).then(p=>{if(alive)setProfile(p);}).catch(()=>{if(alive)setMessage("Unable to load account details. Refresh to retry.");});return()=>{alive=false;};},[path]);
  if(path!=="/") return null;
  async function assign(){setBusy(true);setMessage("");try{const r=await fetch("/api/account",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"assign-legacy-records"})});if(!r.ok)throw Error("Unable to assign records. Please retry.");window.location.reload();}catch(e){setMessage(e instanceof Error?e.message:"Unable to assign records.");setBusy(false);}}
  return <section aria-label="Your account" style={{padding:"12px 20px",borderBottom:"1px solid #ccc",fontSize:14}}>
    {profile&&<p>Signed in as <strong>{profile.displayName}</strong> · {profile.email}{profile.role==="admin"?<> · <a href="/admin" style={{textDecoration:"underline"}}>Administration</a> · <a href="/invitations" style={{textDecoration:"underline"}}>Manage invitations</a></>:""}</p>}
    {profile?.support&&<aside aria-label="Administrator support mode" style={{background:"#713f12",color:"white",padding:16,marginTop:12,borderRadius:8,fontSize:16}}><strong>Helping {profile.support.displayName}</strong><p style={{overflowWrap:"anywhere"}}>{profile.support.email}</p><p>Records and settings on this page belong to this shooter. Your changes are recorded in the administrative history.</p><a href="/" style={{display:"inline-block",marginTop:8,textDecoration:"underline"}}>Exit support mode · Return to my records</a></aside>}
    {!!profile?.legacy&&(profile.legacy.shoots>0||profile.legacy.settings>0)&&<div style={{marginTop:12}}><p>{profile.legacy.shoots} existing shoots and {profile.legacy.settings} classification settings are waiting to be assigned to your account. Scores and notes will be preserved.</p><button type="button" disabled={busy} onClick={()=>void assign()} style={{padding:10,border:"1px solid #777",borderRadius:8,marginTop:8}}>{busy?"Assigning…":"Assign existing records to my account"}</button></div>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
