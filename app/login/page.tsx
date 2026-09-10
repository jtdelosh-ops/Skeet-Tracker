"use client";
import { useState } from "react";

export default function Login() {
  const [email,setEmail]=useState("");
  const [code,setCode]=useState("");
  const [challenge,setChallenge]=useState("");
  const [remember,setRemember]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(verify:boolean) {
    setBusy(true); setMessage("");
    try {
      const response=await fetch(`/api/auth/${verify?"verify":"request"}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(verify?{challenge,code,remember}:{email})});
      const result=await response.json();
      if(!response.ok) throw Error(result.error || "Unable to sign in.");
      if(verify) window.location.assign("/");
      else {setChallenge(result.challenge);setCode("");setMessage(result.message);}
    } catch(error) {setMessage(error instanceof Error?error.message:"Unable to sign in. Please retry.");}
    finally {setBusy(false);}
  }
  return <main style={{maxWidth:460,margin:"48px auto",padding:24}}>
    <h1 style={{fontSize:28,fontWeight:700}}>Sign in to Skeet Tracker</h1>
    <p style={{margin:"16px 0"}}>This first login test is available to James only. Enter your email to receive a six-digit code.</p>
    <form onSubmit={e=>{e.preventDefault();void submit(!!challenge);}}>
      <label htmlFor="email">Email address</label>
      <input id="email" type="email" autoComplete="email" required value={email} disabled={busy||!!challenge} onChange={e=>setEmail(e.target.value)} style={{display:"block",width:"100%",border:"1px solid #777",borderRadius:8,padding:12,margin:"8px 0 16px"}}/>
      {challenge&&<><label htmlFor="code">Six-digit code</label><input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)} style={{display:"block",width:"100%",border:"1px solid #777",borderRadius:8,padding:12,margin:"8px 0 16px"}}/><label style={{display:"block",marginBottom:16}}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Remember this device for 30 days</label></>}
      <button disabled={busy} type="submit" style={{padding:"12px 20px",background:"#174b35",color:"white",borderRadius:8}}>{busy?"Please wait…":challenge?"Verify and sign in":"Send code"}</button>
      {challenge&&<button type="button" disabled={busy} onClick={()=>{setChallenge("");setMessage("");}} style={{padding:12}}>Use another email or request a new code</button>}
      <p role="status" style={{marginTop:16}}>{message}</p>
    </form>
  </main>;
}
