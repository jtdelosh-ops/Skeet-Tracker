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
  useEffect(()=>{const value=new URLSearchParams(window.location.hash.slice(1)).get("invite");if(value){setSignup(true);setInviteCode(value);window.history.replaceState(null,"","/login");}},[]);
  async function submit(verify:boolean) {
    setBusy(true); setMessage("");
    try {
      const response=await fetch(`/api/auth/${verify?"verify":"request"}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(verify?{challenge,code,remember}:{email,...(signup?{inviteCode,displayName,acceptSupportAccess}:{})})});
      const result=await response.json() as {error?:string;challenge:string;message:string};
      if(!response.ok) throw Error(result.error || "Unable to sign in.");
      if(verify) window.location.assign("/");
      else {setChallenge(result.challenge);setCode("");setMessage(result.message);}
    } catch(error) {setMessage(error instanceof Error?error.message:"Unable to sign in. Please retry.");}
    finally {setBusy(false);}
  }
  return <main style={{maxWidth:460,margin:"48px auto",padding:24}}>
    <h1 style={{fontSize:28,fontWeight:700}}>{signup?"Join Skeet Tracker":"Sign in to Skeet Tracker"}</h1>
    <p style={{margin:"16px 0"}}>{challenge?`Enter the six-digit code sent to ${email}. Keep this page open while you check your email.`:signup?"Enter your invitation and the email address James invited. We’ll send a six-digit code to verify your email.":"Enter your account email to receive a six-digit code."}</p>
    <form onSubmit={e=>{e.preventDefault();void submit(!!challenge);}}>
      <label htmlFor="email">Email address</label>
      <input id="email" type="email" autoComplete="email" required value={email} disabled={busy||!!challenge} onChange={e=>setEmail(e.target.value)} style={{display:"block",width:"100%",border:"1px solid #777",borderRadius:8,padding:12,margin:"8px 0 16px"}}/>
      {signup&&!challenge&&<>
        <label htmlFor="invite">Invitation code</label>
        <input id="invite" required autoComplete="off" spellCheck={false} maxLength={64} value={inviteCode} disabled={busy} onChange={e=>setInviteCode(e.target.value.trim())} style={{display:"block",width:"100%",border:"1px solid #777",borderRadius:8,padding:12,margin:"8px 0 16px"}}/>
        <label htmlFor="display-name">Your display name</label>
        <input id="display-name" required autoComplete="name" maxLength={80} value={displayName} disabled={busy} onChange={e=>setDisplayName(e.target.value)} style={{display:"block",width:"100%",border:"1px solid #777",borderRadius:8,padding:12,margin:"8px 0 16px"}}/>
        <p style={{marginBottom:12}}>Each account is for one shooter. James, the administrator, has permission to access your records to assist with uploading records and correcting issues.</p>
        <label style={{display:"block",marginBottom:20}}><input type="checkbox" required checked={acceptSupportAccess} disabled={busy} onChange={e=>setAcceptSupportAccess(e.target.checked)}/> I understand this administrator access.</label>
      </>}
      {challenge&&<><label htmlFor="code">Six-digit code</label><input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)} style={{display:"block",width:"100%",border:"1px solid #777",borderRadius:8,padding:12,margin:"8px 0 16px"}}/><label style={{display:"block",marginBottom:16}}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Remember this device for 30 days</label></>}
      <button disabled={busy} type="submit" style={{padding:"12px 20px",background:"#174b35",color:"white",borderRadius:8}}>{busy?"Please wait…":challenge?(signup?"Verify and create account":"Verify and sign in"):"Send code"}</button>
      {challenge&&<button type="button" disabled={busy} onClick={()=>{setChallenge("");setMessage("");}} style={{padding:12}}>Use another email or request a new code</button>}
      <p role="status" style={{marginTop:16}}>{message}</p>
    </form>
    {!challenge&&<button type="button" disabled={busy} onClick={()=>{setSignup(!signup);setMessage("");}} style={{padding:"16px 0",textDecoration:"underline"}}>{signup?"Already have an account? Sign in":"Have an invitation? Create your account"}</button>}
  </main>;
}
