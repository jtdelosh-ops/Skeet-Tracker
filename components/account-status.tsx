"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
type Profile={displayName:string;email:string;role:string;legacy:null|{shoots:number;settings:number}};
export function AccountStatus() {
  const path=usePathname();
  const [profile,setProfile]=useState<Profile|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{if(path!=="/") return;let alive=true;void fetch("/api/account").then(async r=>{if(!r.ok) throw Error("Unable to load account.");return r.json() as Promise<Profile>;}).then(p=>{if(alive)setProfile(p);}).catch(()=>{if(alive)setMessage("Unable to load account details. Refresh to retry.");});return()=>{alive=false;};},[path]);
  if(path!=="/") return null;
  async function assign(){setBusy(true);setMessage("");try{const r=await fetch("/api/account",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"assign-legacy-records"})});if(!r.ok)throw Error("Unable to assign records. Please retry.");window.location.reload();}catch(e){setMessage(e instanceof Error?e.message:"Unable to assign records.");setBusy(false);}}
  return <section aria-label="Your account" style={{padding:"12px 20px",borderBottom:"1px solid #ccc",fontSize:14}}>
    {profile&&<p>Signed in as <strong>{profile.displayName}</strong> · {profile.email}{profile.role==="admin"?" · Administrator":""}</p>}
    {!!profile?.legacy&&(profile.legacy.shoots>0||profile.legacy.settings>0)&&<div style={{marginTop:12}}><p>{profile.legacy.shoots} existing shoots and {profile.legacy.settings} classification settings are waiting to be assigned to your account. Scores and notes will be preserved.</p><button type="button" disabled={busy} onClick={()=>void assign()} style={{padding:10,border:"1px solid #777",borderRadius:8,marginTop:8}}>{busy?"Assigning…":"Assign existing records to my account"}</button></div>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
