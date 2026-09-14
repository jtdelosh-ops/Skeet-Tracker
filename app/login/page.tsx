"use client";
import { useEffect, useState } from "react";

export default function Login() {
  const [email,setEmail]=useState("");
  const [code,setCode]=useState("");
  const [challenge,setChallenge]=useState("");
  const [remember,setRemember]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [signup,setSignup]=useState(false);
  const [inviteCode,setInviteCode]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [acceptSupportAccess,setAcceptSupportAccess]=useState(false);
  const [inviteReady,setInviteReady]=useState(false);
  const [loadingInvite,setLoadingInvite]=useState(false);
  useEffect(()=>{const value=new URLSearchParams(window.location.hash.slice(1)).get("invite");if(!value)return;setSignup(true);setInviteCode(value);setLoadingInvite(true);window.history.replaceState(null,"","/login");void fetch("/api/auth/invitation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({inviteCode:value})}).then(async response=>{const data=await response.json() as {email:string;error?:string};if(!response.ok)throw Error(data.error||"Unable to open this invitation.");setEmail(data.email);setInviteReady(true);}).catch(error=>setMessage(error instanceof Error?error.message:"Unable to open this invitation. Reopen the link to retry.")).finally(()=>setLoadingInvite(false));},[]);
  async function submit(verify:boolean) {
    setBusy(true); setMessage("");
    try {
      const response=await fetch(`/api/auth/${verify?"verify":"request"}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(verify?{challenge,code,remember}:signup?{inviteCode,displayName,acceptSupportAccess}:{email})});
      const result=await response.json() as {error?:string;challenge:string;message:string};
      if(!response.ok) throw Error(result.error || "Unable to sign in.");
      if(verify) window.location.assign("/");
      else {setChallenge(result.challenge);setCode("");setMessage(result.message);}
    } catch(error) {setMessage(error instanceof Error?error.message:"Unable to sign in. Please retry.");}
    finally {setBusy(false);}
  }
  return <main style={{maxWidth:460,margin:"48px auto",padding:24}}>
    <h1 style={{fontSize:28,fontWeight:700}}>{signup?"Join Skeet Tracker":"Sign in to Skeet Tracker"}</h1>
    <p style={{margin:"16px 0"}}>{challenge?`Enter the six-digit code sent to ${email}. Keep this page open while you check your email.`:signup?(loadingInvite?"Opening your invitation…":inviteReady?"Enter your name to get started. We’ll send a six-digit code to your invited email.":"Open the invitation link James emailed you to create your account."):"Enter your account email to receive a six-digit code."}</p>
    {signup&&inviteReady&&!challenge&&<p style={{marginBottom:20,overflowWrap:"anywhere"}}>Your account email: <strong>{email}</strong></p>}
    {(!signup||inviteReady)&&<form onSubmit={e=>{e.preventDefault();void submit(!!challenge);}}>
      {!signup&&<><label htmlFor="email">Email address</label>
      <input id="email" type="email" autoComplete="email" required value={email} disabled={busy||!!challenge} onChange={e=>setEmail(e.target.value)} style={{display:"block",width:"100%",border:"1px solid #777",borderRadius:8,padding:12,margin:"8px 0 16px"}}/></>}
      {signup&&!challenge&&<>
        <label htmlFor="display-name">Your display name</label>
        <input id="display-name" required autoComplete="name" maxLength={80} value={displayName} disabled={busy} onChange={e=>setDisplayName(e.target.value)} style={{display:"block",width:"100%",border:"1px solid #777",borderRadius:8,padding:12,margin:"8px 0 16px"}}/>
        <p style={{marginBottom:12}}>Each account is for one shooter. James, the administrator, has permission to access your records to assist with uploading records and correcting issues.</p>
        <label style={{display:"block",marginBottom:20}}><input type="checkbox" required checked={acceptSupportAccess} disabled={busy} onChange={e=>setAcceptSupportAccess(e.target.checked)}/> I understand this administrator access.</label>
      </>}
      {challenge&&<><label htmlFor="code">Six-digit code</label><input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)} style={{display:"block",width:"100%",border:"1px solid #777",borderRadius:8,padding:12,margin:"8px 0 16px"}}/><label style={{display:"block",marginBottom:16}}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Remember this device for 30 days</label></>}
      <button disabled={busy} type="submit" style={{padding:"12px 20px",background:"#174b35",color:"white",borderRadius:8}}>{busy?"Please wait…":challenge?(signup?"Verify and create account":"Verify and sign in"):"Send code"}</button>
      {challenge&&<button type="button" disabled={busy} onClick={()=>{setChallenge("");setMessage("");}} style={{padding:12}}>{signup?"Request a new verification code":"Use another email or request a new code"}</button>}
    </form>}
    <p role="status" style={{marginTop:16}}>{message}</p>
    {!challenge&&<button type="button" disabled={busy||loadingInvite} onClick={()=>{setSignup(!signup);setMessage("");}} style={{padding:"16px 0",textDecoration:"underline"}}>{signup?"Already have an account? Sign in":"Have an invitation? Create your account"}</button>}
  </main>;
}
