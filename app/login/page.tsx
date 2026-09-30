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
  const [showForm,setShowForm]=useState(false);
  useEffect(()=>{const value=new URLSearchParams(window.location.hash.slice(1)).get("invite");if(!value)return;setShowForm(true);setSignup(true);setInviteCode(value);setLoadingInvite(true);window.history.replaceState(null,"","/login");void fetch("/api/auth/invitation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({inviteCode:value})}).then(async response=>{const data=await response.json() as {email:string;error?:string};if(!response.ok)throw Error(data.error||"Unable to open this invitation.");setEmail(data.email);setInviteReady(true);}).catch(error=>setMessage(error instanceof Error?error.message:"Unable to open this invitation. Reopen the link to retry.")).finally(()=>setLoadingInvite(false));},[]);
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
  if(!showForm) return <main className="skeet-entry">
    <nav className="entry-nav" aria-label="Skeet Tracker"><a className="entry-wordmark" href="/login" aria-label="Skeet Tracker home"><img src="/skeet-tracker-logo.png" alt="Skeet Tracker" /></a><span>BY JAMES DELOSH</span></nav>
    <section className="entry-hero" aria-labelledby="entry-title">
      <div className="entry-copy"><p className="entry-kicker">BUILT FOR THE WAY YOU SHOOT</p><h1 id="entry-title">Every round.<br/><em>In context.</em></h1><p className="entry-lede">A clearer view of your registered skeet scores, classifications, and progress, all in one place.</p>
        <div className="entry-actions"><button className="entry-primary" type="button" onClick={()=>setShowForm(true)}>Sign in <span aria-hidden="true">→</span></button><a className="entry-secondary" href="#features">Take the tour <span aria-hidden="true">↓</span></a></div>
        <p className="entry-access">No ChatGPT account needed. Accounts are invitation only.</p>
      </div>
      <div className="entry-preview" aria-label="Sample Skeet Tracker dashboard preview">
        <div className="preview-head"><div><span className="preview-label">SAMPLE VIEW</span><strong>Season snapshot</strong></div><span className="preview-period">2026 SEASON</span></div>
        <div className="preview-summary"><div><span>HOA</span><strong>94.8</strong><small>4-gun average</small></div><div><span>HAA</span><strong>94.1</strong><small>5-gun average</small></div></div>
        <div className="preview-divider"/><p className="preview-section-title">AVERAGE BY EVENT <span>RECENT SCORES</span></p>
        <div className="preview-event"><span className="event-gauge">12</span><div className="event-track"><span style={{width:"78%"}} /></div><strong>95.2</strong><small>B</small></div>
        <div className="preview-event"><span className="event-gauge">20</span><div className="event-track"><span style={{width:"71%"}} /></div><strong>94.6</strong><small>A</small></div>
        <div className="preview-event"><span className="event-gauge">28</span><div className="event-track"><span style={{width:"66%"}} /></div><strong>94.2</strong><small>AA</small></div>
        <div className="preview-event"><span className="event-gauge">.410</span><div className="event-track"><span style={{width:"57%"}} /></div><strong>93.8</strong><small>A</small></div>
        <div className="preview-history"><span className="history-mark"/><div><strong>North Carolina State Open</strong><small>Sep 12 · Main</small></div><b>364<span>/400</span></b></div>
        <p className="preview-footnote">Illustrative sample · your records stay private to your account</p>
      </div>
    </section>
    <section className="entry-features" id="features" aria-labelledby="features-title"><div className="entry-section-heading"><p className="entry-kicker">MADE FOR THE SPORT</p><h2 id="features-title">More than a scorecard.</h2><p>See how each event fits into your season, and keep the details behind every result.</p></div>
      <div className="entry-feature-grid">
        <article className="entry-feature"><span className="feature-number">01</span><h3>Know where you stand</h3><p>Follow rolling averages and classifications across 12, 20, and 28 gauge, .410, and doubles. See the events behind the numbers, with HOA and HAA in view.</p></article>
        <article className="entry-feature"><span className="feature-number">02</span><h3>Bring your history with you</h3><p>Import a CSV or screenshots of NSSA records. Review and correct extracted scores before they’re saved. Check duplicates and undo an import when needed.</p></article>
        <article className="entry-feature"><span className="feature-number">03</span><h3>Keep every shoot in context</h3><p>Record tournaments and monthly targets, track preliminary and main events separately, add notes, and search your shooting history.</p></article>
      </div>
    </section>
    <section className="entry-how" aria-labelledby="how-title"><div><p className="entry-kicker">PRIVATE BY DESIGN</p><h2 id="how-title">Your records.<br/>Your account.</h2><p>Each account belongs to one shooter. Your records are private. James can help with uploads or corrections only with your permission.</p></div><div className="entry-steps"><p><span>1</span><strong>Get an invitation</strong><small>Ask James for access.</small></p><p><span>2</span><strong>Verify your email</strong><small>No password or ChatGPT account required.</small></p><p><span>3</span><strong>Make it yours</strong><small>Record new scores or import your history.</small></p></div></section>
    <footer className="entry-footer"><a className="entry-wordmark" href="/login"><img src="/skeet-tracker-logo.png" alt="Skeet Tracker" /></a><span>Built by James Delosh · For NSSA shooters</span></footer>
  </main>;
  return <main className="login-shell" style={{maxWidth:460,margin:"48px auto",padding:24}}>
    {!signup&&!challenge&&<button type="button" className="login-back" onClick={()=>setShowForm(false)}>← Back to the tour</button>}
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
    {signup&&!inviteReady&&!challenge&&<button type="button" onClick={()=>{setShowForm(false);setSignup(false);setMessage("");}} style={{padding:"12px 0",textDecoration:"underline"}}>Back to the tour</button>}
    {!challenge&&<button type="button" disabled={busy||loadingInvite} onClick={()=>{setSignup(!signup);setMessage("");}} style={{padding:"16px 0",textDecoration:"underline"}}>{signup?"Already have an account? Sign in":"Have an invitation? Create your account"}</button>}
  </main>;
}
