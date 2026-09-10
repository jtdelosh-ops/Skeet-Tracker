"use client";
import { useEffect,useState } from "react";
import { trackerFetch } from "@/lib/tracker-fetch";
import { importEvents,validateImportRow,type DraftRow } from "@/lib/import-format";
type Check={error:string|null;duplicate:string|null};
type Batch={id:string;source:string;createdAt:number;total:number;undoneAt:number|null};
type Profile={batches:Batch[];imageEnabled:boolean;account:{name:string;email:string;support:boolean}};
type Row=DraftRow&{selected:boolean};
const field={padding:9,border:'1px solid #888',borderRadius:6,width:'100%',fontSize:16} as const;
const button={padding:'12px 18px',borderRadius:8,background:'#174b35',color:'white'} as const;
export default function Imports(){
  const [profile,setProfile]=useState<Profile|null>(null),[file,setFile]=useState<File|null>(null),[image,setImage]=useState(''),[source,setSource]=useState('');
  const [rows,setRows]=useState<Row[]>([]),[checks,setChecks]=useState<Check[]>([]),[checked,setChecked]=useState(false),[confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[warnings,setWarnings]=useState<string[]>([]),[reference,setReference]=useState<Record<string,string>>({}),[totals,setTotals]=useState<Record<string,string>>({});
  const [requestId,setRequestId]=useState(''),[back,setBack]=useState('/');
  async function load(){const r=await trackerFetch('/api/imports');const data=await r.json() as Profile&{error?:string};if(!r.ok)throw Error(data.error||'Unable to load imports.');setProfile(data);}
  useEffect(()=>{setBack('/'+window.location.search);void load().catch(e=>setMessage(e.message));},[]);
  useEffect(()=>()=>{if(image)URL.revokeObjectURL(image);},[image]);
  const selected=rows.filter(r=>r.selected);
  const invalid=selected.some(row=>{try{validateImportRow(row);return false;}catch{return true;}});
  function invalidate(){setChecked(false);setConfirmed(false);setChecks([]);setRequestId(crypto.randomUUID());}
  function edit(index:number,change:Partial<Row>){setRows(current=>current.map((r,i)=>i===index?{...r,...change}:r));invalidate();}
  async function post(body:unknown){const r=await trackerFetch('/api/imports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as Record<string,unknown>&{error?:string};if(!r.ok)throw Error(d.error||'Import request failed.');return d;}
  async function preview(){if(!file||busy)return;setBusy(true);setMessage('');try{
    let data:{rows:DraftRow[];warnings?:string[];startingClasses?:Record<string,string>;totals?:Record<string,string>};
    const csv=/\.csv$/i.test(file.name);
    if(csv){if(file.size>500000)throw Error('CSV files must be 500 KB or smaller.');data=await post({action:'csv',csv:await file.text()}) as unknown as typeof data;setImage('');}
    else{if(!profile?.imageEnabled)throw Error('Screenshot extraction is not configured yet. CSV import is available.');if(file.size>8000000)throw Error('Use an image under 8 MB.');const form=new FormData();form.set('file',file);const r=await trackerFetch('/api/imports/extract',{method:'POST',body:form});const result=await r.json() as typeof data&{error?:string};if(!r.ok)throw Error(result.error||'Unable to read this image.');data=result;setImage(URL.createObjectURL(file));}
    setRows(data.rows.map(r=>({...r,selected:true})));setSource(file.name);setWarnings(data.warnings??[]);setReference(data.startingClasses??{});setTotals(data.totals??{});invalidate();setMessage('Review every row. Nothing has been saved yet.');
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to read file.');}finally{setBusy(false);}}
  async function check(){setBusy(true);setMessage('');try{const result=await post({action:'inspect',rows});const next=result.checks as Check[];setChecks(next);setRows(current=>current.map((r,i)=>({...r,selected:r.selected&&!next[i].duplicate})));setChecked(true);setConfirmed(false);setMessage(next.some(c=>c.duplicate)?'Likely duplicates were excluded. Review the remaining selected rows.':'Duplicate check complete. Confirm the selected rows before importing.');}catch(e){setMessage(e instanceof Error?e.message:'Unable to check records.');}finally{setBusy(false);}}
  async function commit(){if(!confirmed||!checked||invalid||!selected.length||busy)return;setBusy(true);setMessage('');try{const result=await post({action:'commit',id:requestId,source,rows:selected,reviewed:true});setRows([]);setImage('');setFile(null);setMessage(result.undone?'This batch was already undone.':`Imported ${result.total} shoots into ${profile?.account.name}’s account.`);await load();}catch(e){setMessage(e instanceof Error?e.message:'Import could not be confirmed. Retry without changing the preview to safely check the same request.');}finally{setBusy(false);}}
  async function undo(batch:Batch){if(!window.confirm(`Undo ${batch.total} shoots from ${batch.source}? Records edited since import will block undo.`))return;setBusy(true);setMessage('');try{await post({action:'undo',id:batch.id});setMessage('Import undone.');await load();invalidate();}catch(e){setMessage(e instanceof Error?e.message:'Unable to undo this batch.');}finally{setBusy(false);}}
  const mismatches=importEvents.flatMap(event=>{const expected=/^(\d+)\/(\d+)$/.exec((totals[event]??'').replace(/\s/g,''));if(!expected)return [];let broken=0,targets=0;for(const row of rows){const score=/^(\d+)\s*\/\s*(\d+)/.exec(row.scores[event]);if(score){broken+=Number(score[1]);targets+=Number(score[2]);}}return broken!==Number(expected[1])||targets!==Number(expected[2])?[`${event}: extracted rows total ${broken}/${targets}; the source reports ${expected[1]}/${expected[2]}. Check for missed or incorrect rows.`]:[];});
  return <main style={{maxWidth:1300,margin:'28px auto',padding:24}}>
    <a href={back} style={{textDecoration:'underline'}}>Back to tracker</a><h1 style={{fontSize:28,fontWeight:700,margin:'16px 0'}}>Import existing records</h1>
    {profile&&<aside style={{padding:16,borderRadius:8,background:profile.account.support?'#713f12':'#174b35',color:'white',marginBottom:20}}><strong>{profile.account.support?'Helping':'Importing for'} {profile.account.name}</strong><p style={{overflowWrap:'anywhere'}}>{profile.account.email}</p>{profile.account.support&&<p>Administrative imports and undo actions are recorded in the correction history. <a href="/" style={{textDecoration:'underline'}}>Return to my records</a></p>}</aside>}
    <p>Upload a CSV or an NSSA screenshot/photo. Review and correct the extracted records before saving. Up to 100 shoots per batch.</p>
    <p style={{margin:'12px 0'}}><a href="/skeet-import-template.csv" download style={{textDecoration:'underline'}}>Download example CSV template</a> · Dates: YYYY-MM-DD or MM/DD/YYYY · Scores: 94/100 A · Leave unshot events blank.</p>
    <section style={{padding:20,border:'1px solid #888',borderRadius:12,margin:'20px 0'}}><label htmlFor="import-file">Choose a CSV, PNG, JPEG, or WebP file</label><input id="import-file" type="file" accept=".csv,image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)} style={{display:'block',margin:'12px 0',maxWidth:'100%'}}/>
      <p style={{marginBottom:12}}>Images are sent to OpenAI only when you select Preview file. The tracker does not store the original image. CSV files do not use image processing.</p>
      {profile&&!profile.imageEnabled&&<p style={{marginBottom:12}}>Screenshot extraction needs setup by James. CSV import is ready.</p>}
      <button style={button} disabled={busy||!file||!profile} onClick={()=>void preview()}>{busy?'Working…':'Preview file'}</button>
    </section>
    <p role="status" style={{margin:'16px 0'}}>{message}</p>
    {!!rows.length&&<><h2 style={{fontSize:22,fontWeight:600}}>Review {source}</h2>
      {[...warnings,...mismatches].map((w,i)=><p key={i} style={{margin:'8px 0',color:'#92400e'}}>Review: {w}</p>)}
      {Object.values(reference).some(Boolean)&&<p style={{margin:'12px 0'}}>Starting classes shown in source: {Object.entries(reference).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(' · ')}. Reference only; your classification settings will not be changed.</p>}
      <div style={{margin:'16px 0'}}><label htmlFor="all-type">Set event type for all rows: </label><select id="all-type" defaultValue="" disabled={busy} onChange={e=>{const label=e.target.value;if(label){setRows(current=>current.map(r=>({...r,label})));invalidate();}e.target.value='';}} style={{padding:8,border:'1px solid #888'}}><option value="">Choose only if the source supports it</option><option>Main</option><option>Preliminary</option></select></div>
      <div style={{display:'grid',gridTemplateColumns:image?'repeat(auto-fit,minmax(min(100%,470px),1fr))':'1fr',gap:24,alignItems:'start'}}>
        {image&&<div style={{position:'sticky',top:12}}><h3 style={{fontWeight:600,marginBottom:8}}>Source image</h3><a href={image} target="_blank" rel="noreferrer"><img src={image} alt="Source record image for comparison" style={{width:'100%',height:'auto',border:'1px solid #888'}}/></a><p>Open the image to zoom in.</p></div>}
        <div>{rows.map((row,i)=>{let error='';try{validateImportRow(row);}catch(e){error=e instanceof Error?e.message:'Invalid record.';}return <fieldset key={i} disabled={busy} style={{padding:16,border:'1px solid #888',borderRadius:10,marginBottom:16,minWidth:0}}><legend>Row {i+1}</legend>
          <label><input type="checkbox" checked={row.selected} onChange={e=>edit(i,{selected:e.target.checked})}/> Include this shoot</label>
          {checks[i]?.duplicate&&<p style={{color:'#92400e'}}>Excluded: {checks[i].duplicate}</p>}{error&&<p style={{color:'#b91c1c',margin:'8px 0'}}>{error}</p>}{row.warnings.map((w,j)=><p key={j} style={{color:'#92400e'}}>Check: {w}</p>)}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginTop:12}}><label>Shoot number<input value={row.shootNumber} onChange={e=>edit(i,{shootNumber:e.target.value})} style={field}/></label><label>Date<input value={row.date} placeholder="YYYY-MM-DD" onChange={e=>edit(i,{date:e.target.value})} style={field}/></label><label>Event type<select value={row.label} onChange={e=>edit(i,{label:e.target.value})} style={field}><option value="">Select type</option><option>Main</option><option>Preliminary</option></select></label></div>
          <label style={{display:'block',marginTop:12}}>Shoot name<input value={row.name} onChange={e=>edit(i,{name:e.target.value})} style={field}/></label>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(115px,1fr))',gap:10,marginTop:12}}>{importEvents.map(event=><label key={event}>{event==='410'?'.410':event==='doubles'?'Doubles':`${event} gauge`}<input value={row.scores[event]} placeholder="94/100 A" onChange={e=>edit(i,{scores:{...row.scores,[event]:e.target.value}})} style={field}/></label>)}</div>
        </fieldset>;})}</div>
      </div>
      <section style={{padding:20,border:'1px solid #888',borderRadius:10}}><p>{selected.length} shoots selected. Existing records will never be overwritten.</p><button disabled={busy||!rows.length} onClick={()=>void check()} style={{...button,margin:'12px 0'}}>Check for duplicates</button><label style={{display:'block',margin:'12px 0'}}><input type="checkbox" checked={confirmed} disabled={!checked||busy||invalid||!selected.length} onChange={e=>setConfirmed(e.target.checked)}/> I checked the selected names, dates, scores, classes, event types, and all warnings against the source.</label><button style={button} disabled={busy||!checked||!confirmed||invalid||!selected.length} onClick={()=>void commit()}>Import {selected.length} selected shoots</button></section>
    </>}
    <section style={{marginTop:32}}><h2 style={{fontSize:22,fontWeight:600}}>Recent import batches</h2>{profile?.batches.length===0&&<p>No imports yet.</p>}{profile?.batches.map(batch=><article key={batch.id} style={{padding:'16px 0',borderBottom:'1px solid #ccc',overflowWrap:'anywhere'}}><strong>{batch.source}</strong><p>{batch.total} shoots · {new Date(batch.createdAt).toLocaleString()} · {batch.undoneAt?'Undone':'Imported'}</p>{!batch.undoneAt&&<button disabled={busy} onClick={()=>void undo(batch)} style={{padding:'8px 0',textDecoration:'underline'}}>Undo this import</button>}</article>)}</section>
  </main>;
}
