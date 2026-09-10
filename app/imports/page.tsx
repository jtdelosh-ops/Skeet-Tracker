"use client";
import { useEffect,useState,useRef } from "react";
import { trackerFetch } from "@/lib/tracker-fetch";
import { importEvents,validateImportRow,type DraftRow } from "@/lib/import-format";
type Check={error:string|null;duplicate:string|null};
type Batch={id:string;source:string;createdAt:number;total:number;undoneAt:number|null};
type Profile={batches:Batch[];imageEnabled:boolean;account:{name:string;email:string;support:boolean}};
type Row=DraftRow&{selected:boolean;sourceId:string};
type Upload={id:string;file:File;image:string;status:'pending'|'working'|'ready'|'failed';error?:string;warnings:string[];reference:Record<string,string>;totals:Record<string,string>};
const field={padding:9,border:'1px solid #888',borderRadius:6,width:'100%',fontSize:16} as const;
const button={padding:'12px 18px',borderRadius:8,background:'#174b35',color:'white'} as const;
export default function Imports(){
  const [profile,setProfile]=useState<Profile|null>(null),[uploads,setUploads]=useState<Upload[]>([]),[activeSource,setActiveSource]=useState('');
  const [rows,setRows]=useState<Row[]>([]),[checks,setChecks]=useState<Check[]>([]),[checked,setChecked]=useState(false),[confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [requestId,setRequestId]=useState(''),[back,setBack]=useState('/');
  async function load(){const r=await trackerFetch('/api/imports');const data=await r.json() as Profile&{error?:string};if(!r.ok)throw Error(data.error||'Unable to load imports.');setProfile(data);}
  useEffect(()=>{setBack('/'+window.location.search);void load().catch(e=>setMessage(e.message));},[]);
  const imageUrls=useRef<string[]>([]);
  const source=uploads.filter(u=>u.status==='ready').map(u=>u.file.name).join(', ');
  const active=uploads.find(u=>u.id===activeSource)??uploads.find(u=>u.status==='ready');
  const image=active?.image??'';
  const reference=active?.reference??{};
  const unresolved=uploads.some(u=>u.status!=='ready');
  const tooMany=rows.length>100;
  useEffect(()=>()=>{imageUrls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
  function clearImages(){imageUrls.current.forEach(url=>URL.revokeObjectURL(url));imageUrls.current=[];}
  function imageUrl(file:File){if(/\.csv$/i.test(file.name))return '';const url=URL.createObjectURL(file);imageUrls.current.push(url);return url;}
  function choose(files:File[]){
    if(files.length>5){setMessage('Choose up to five images at a time.');return;}
    if(files.some(f=>/\.csv$/i.test(f.name))&&files.length>1){setMessage('Choose one CSV by itself, or up to five images.');return;}
    if(files.some(f=>!/\.(csv|png|jpe?g|webp)$/i.test(f.name))){setMessage('Use CSV, PNG, JPEG, or WebP files.');return;}
    if(files.some(f=>f.size>(/\.csv$/i.test(f.name)?500000:8000000))){setMessage('Each image must be under 8 MB; CSV files must be 500 KB or smaller.');return;}
    clearImages();
    setUploads(files.map(file=>({id:crypto.randomUUID(),file,image:imageUrl(file),status:'pending',warnings:[],reference:{},totals:{}})));
    setRows([]);setActiveSource('');invalidate();setMessage('Files selected. Choose Preview files to begin.');
  }
  function remove(id:string){const url=uploads.find(u=>u.id===id)?.image;if(url){URL.revokeObjectURL(url);imageUrls.current=imageUrls.current.filter(v=>v!==url);}setUploads(current=>current.filter(u=>u.id!==id));setRows(current=>current.filter(r=>r.sourceId!==id));invalidate();}

  const selected=rows.filter(r=>r.selected);
  const invalid=selected.some(row=>{try{validateImportRow(row);return false;}catch{return true;}});
  function invalidate(){setChecked(false);setConfirmed(false);setChecks([]);setRequestId(crypto.randomUUID());}
  function edit(index:number,change:Partial<Row>){setRows(current=>current.map((r,i)=>i===index?{...r,...change}:r));invalidate();}
  async function post(body:unknown){const r=await trackerFetch('/api/imports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as Record<string,unknown>&{error?:string};if(!r.ok)throw Error(d.error||'Import request failed.');return d;}
  async function preview(onlyId?:string){if(busy)return;setBusy(true);invalidate();
    for(const upload of uploads.filter(u=>u.status!=='ready'&&(!onlyId||u.id===onlyId))){
      setMessage(`Reading ${upload.file.name}…`);
      setUploads(current=>current.map(u=>u.id===upload.id?{...u,status:'working',error:undefined}:u));
      try{
        let data:{rows:DraftRow[];warnings?:string[];startingClasses?:Record<string,string>;totals?:Record<string,string>};
        if(/\.csv$/i.test(upload.file.name)){data=await post({action:'csv',csv:await upload.file.text()}) as unknown as typeof data;}
        else{if(!profile?.imageEnabled)throw Error('Screenshot extraction is not configured yet. CSV import is available.');const form=new FormData();form.set('file',upload.file);const r=await trackerFetch('/api/imports/extract',{method:'POST',body:form});const result=await r.json() as typeof data&{error?:string};if(!r.ok)throw Error(result.error||'Unable to read this image.');data=result;}
        setRows(current=>[...current,...data.rows.map(r=>({...r,selected:true,sourceId:upload.id}))]);
        setUploads(current=>current.map(u=>u.id===upload.id?{...u,status:'ready',warnings:data.warnings??[],reference:data.startingClasses??{},totals:data.totals??{}}:u));
        setActiveSource(current=>current||upload.id);
      }catch(e){setUploads(current=>current.map(u=>u.id===upload.id?{...u,status:'failed',error:e instanceof Error?e.message:'Unable to read file.'}:u));}
    }
    setMessage('Review the results below. Retry or remove any failed files before importing. Nothing has been saved.');setBusy(false);
  }
  async function check(){setBusy(true);setMessage('');try{const result=await post({action:'inspect',rows});const next=result.checks as Check[];setChecks(next);setRows(current=>current.map((r,i)=>({...r,selected:r.selected&&!next[i].duplicate})));setChecked(true);setConfirmed(false);setMessage(next.some(c=>c.duplicate)?'Likely duplicates were excluded. Review the remaining selected rows.':'Duplicate check complete. Confirm the selected rows before importing.');}catch(e){setMessage(e instanceof Error?e.message:'Unable to check records.');}finally{setBusy(false);}}
  async function commit(){if(!confirmed||!checked||invalid||!selected.length||busy||unresolved||tooMany)return;setBusy(true);setMessage('');try{const result=await post({action:'commit',id:requestId,source,rows:selected,reviewed:true});setRows([]);clearImages();setUploads([]);setActiveSource('');setMessage(result.undone?'This batch was already undone.':`Imported ${result.total} shoots into ${profile?.account.name}’s account.`);await load();}catch(e){setMessage(e instanceof Error?e.message:'Import could not be confirmed. Retry without changing the preview to safely check the same request.');}finally{setBusy(false);}}
  async function undo(batch:Batch){if(!window.confirm(`Undo ${batch.total} shoots from ${batch.source}? Records edited since import will block undo.`))return;setBusy(true);setMessage('');try{await post({action:'undo',id:batch.id});setMessage('Import undone.');await load();invalidate();}catch(e){setMessage(e instanceof Error?e.message:'Unable to undo this batch.');}finally{setBusy(false);}}
  const mismatches=uploads.flatMap(upload=>importEvents.flatMap(event=>{const expected=/^(\d+)\/(\d+)$/.exec((upload.totals[event]??'').replace(/\s/g,''));if(!expected)return [];let broken=0,targets=0;for(const row of rows.filter(r=>r.sourceId===upload.id)){const score=/^(\d+)\s*\/\s*(\d+)/.exec(row.scores[event]);if(score){broken+=Number(score[1]);targets+=Number(score[2]);}}return broken!==Number(expected[1])||targets!==Number(expected[2])?[`${upload.file.name} — ${event}: extracted rows total ${broken}/${targets}; the source reports ${expected[1]}/${expected[2]}. Check for missed or incorrect rows.`]:[];}));
  return <main style={{maxWidth:1300,margin:'28px auto',padding:24}}>
    <a href={back} style={{textDecoration:'underline'}}>Back to tracker</a><h1 style={{fontSize:28,fontWeight:700,margin:'16px 0'}}>Import existing records</h1>
    {profile&&<aside style={{padding:16,borderRadius:8,background:profile.account.support?'#713f12':'#174b35',color:'white',marginBottom:20}}><strong>{profile.account.support?'Helping':'Importing for'} {profile.account.name}</strong><p style={{overflowWrap:'anywhere'}}>{profile.account.email}</p>{profile.account.support&&<p>Administrative imports and undo actions are recorded in the correction history. <a href="/" style={{textDecoration:'underline'}}>Return to my records</a></p>}</aside>}
    <p>Upload one CSV or up to five NSSA screenshots/photos together. Review and correct the extracted records before saving. Up to 100 shoots per batch.</p>
    <details open style={{margin:'16px 0',padding:16,border:'1px solid #888',borderRadius:8}}><summary style={{fontWeight:600,cursor:'pointer'}}>How to import your history</summary><ol style={{listStyle:'decimal',paddingLeft:24,lineHeight:1.7,marginTop:8}}>
      <li>Open your NSSA shoot history and select a year.</li>
      <li>Capture the full results table, including column headings, shoot names, dates, and scores. Use additional screenshots for more years or longer tables. Overlapping rows are okay—we check for duplicates.</li>
      <li>Select up to five screenshots together, then choose <strong>Preview files</strong>. On a desktop, hold Ctrl (Windows) or Command (Mac) to select several files.</li>
      <li>Review each shoot alongside its source image. Correct mistakes and choose Main or Preliminary where needed.</li>
      <li>Choose <strong>Check for duplicates</strong>, review the selected shoots, and confirm the import. Nothing is saved until you confirm.</li>
    </ol><p style={{marginTop:8}}>Repeat for additional years. Each batch can contain up to 100 shoots. Each image uses one extraction attempt; up to 10 attempts per day per account.</p></details>
    <p style={{margin:'12px 0'}}><a href="/skeet-import-template.csv" download style={{textDecoration:'underline'}}>Download example CSV template</a> · Dates: YYYY-MM-DD or MM/DD/YYYY · Scores: 94/100 A · Leave unshot events blank.</p>
    <section style={{padding:20,border:'1px solid #888',borderRadius:12,margin:'20px 0'}}><label htmlFor="import-file">Choose one CSV or up to five PNG, JPEG, or WebP images</label><input id="import-file" type="file" multiple accept=".csv,image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{choose(Array.from(e.target.files??[]));e.target.value='';}} style={{display:'block',margin:'12px 0',maxWidth:'100%'}}/>
      <p style={{marginBottom:12}}>Images are sent to OpenAI only when you select Preview files. Images are processed one at a time; successful files are kept if another fails. The tracker does not store the original image. CSV files do not use image processing.</p>
      {profile&&!profile.imageEnabled&&<p style={{marginBottom:12}}>Screenshot extraction needs setup by James. CSV import is ready.</p>}
      <button style={button} disabled={busy||!uploads.some(u=>u.status!=='ready')||!profile} onClick={()=>void preview()}>{busy?'Working…':'Preview file'}</button>
      <ul style={{marginTop:16,listStyle:'none'}}>{uploads.map(u=><li key={u.id} style={{padding:'10px 0',overflowWrap:'anywhere'}}><strong>{u.file.name}</strong> — {u.status==='ready'?`${rows.filter(r=>r.sourceId===u.id).length} shoots ready`:u.status==='working'?'Reading…':u.status==='failed'?'Could not read':'Waiting'}
        {u.error&&<p role="alert">{u.error}</p>}{u.status==='failed'&&<button style={{textDecoration:'underline',marginRight:16}} disabled={busy} onClick={()=>void preview(u.id)}>Retry this file</button>} <button style={{textDecoration:'underline'}} disabled={busy} onClick={()=>remove(u.id)}>Remove file</button>
      </li>)}</ul>
    </section>
    <p role="status" style={{margin:'16px 0'}}>{message}</p>
    {!!rows.length&&<><h2 style={{fontSize:22,fontWeight:600}}>Review {source}</h2>
      {[...uploads.flatMap(u=>u.warnings.map(w=>`${u.file.name}: ${w}`)),...mismatches].map((w,i)=><p key={i} style={{margin:'8px 0',color:'#92400e'}}>Review: {w}</p>)}
      {Object.values(reference).some(Boolean)&&<p style={{margin:'12px 0'}}>Starting classes shown in {active?.file.name}: {Object.entries(reference).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(' · ')}. Reference only; your classification settings will not be changed.</p>}
      <div style={{margin:'16px 0'}}><label htmlFor="all-type">Set event type for all rows: </label><select id="all-type" defaultValue="" disabled={busy} onChange={e=>{const label=e.target.value;if(label){setRows(current=>current.map(r=>({...r,label})));invalidate();}e.target.value='';}} style={{padding:8,border:'1px solid #888'}}><option value="">Choose only if the source supports it</option><option>Main</option><option>Preliminary</option></select></div>
      {tooMany&&<p role="alert">This preview has {rows.length} shoots. Remove a file to stay within 100 shoots, then import the remaining files in another batch.</p>}
      {uploads.filter(u=>u.status==='ready').length>1&&<label style={{display:'block',margin:'12px 0'}}>Source to compare <select value={active?.id??''} onChange={e=>setActiveSource(e.target.value)} style={field}>{uploads.filter(u=>u.status==='ready').map(u=><option key={u.id} value={u.id}>{u.file.name}</option>)}</select></label>}
      <div style={{display:'grid',gridTemplateColumns:image?'repeat(auto-fit,minmax(min(100%,470px),1fr))':'1fr',gap:24,alignItems:'start'}}>
        {image&&<div style={{position:'sticky',top:12}}><h3 style={{fontWeight:600,marginBottom:8}}>Source image</h3><a href={image} target="_blank" rel="noreferrer"><img src={image} alt="Source record image for comparison" style={{width:'100%',height:'auto',border:'1px solid #888'}}/></a><p>Open the image to zoom in.</p></div>}
        <div>{rows.map((row,i)=>{let error='';try{validateImportRow(row);}catch(e){error=e instanceof Error?e.message:'Invalid record.';}return <fieldset key={i} disabled={busy} style={{padding:16,border:'1px solid #888',borderRadius:10,marginBottom:16,minWidth:0}}><legend>Row {i+1}</legend><button type="button" onClick={()=>setActiveSource(row.sourceId)} style={{display:'block',textDecoration:'underline',marginBottom:8,overflowWrap:'anywhere'}}>Source: {uploads.find(u=>u.id===row.sourceId)?.file.name}</button>
          <label><input type="checkbox" checked={row.selected} onChange={e=>edit(i,{selected:e.target.checked})}/> Include this shoot</label>
          {checks[i]?.duplicate&&<p style={{color:'#92400e'}}>Excluded: {checks[i].duplicate}</p>}{error&&<p style={{color:'#b91c1c',margin:'8px 0'}}>{error}</p>}{row.warnings.map((w,j)=><p key={j} style={{color:'#92400e'}}>Check: {w}</p>)}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginTop:12}}><label>Shoot number<input value={row.shootNumber} onChange={e=>edit(i,{shootNumber:e.target.value})} style={field}/></label><label>Date<input value={row.date} placeholder="YYYY-MM-DD" onChange={e=>edit(i,{date:e.target.value})} style={field}/></label><label>Event type<select value={row.label} onChange={e=>edit(i,{label:e.target.value})} style={field}><option value="">Select type</option><option>Main</option><option>Preliminary</option></select></label></div>
          <label style={{display:'block',marginTop:12}}>Shoot name<input value={row.name} onChange={e=>edit(i,{name:e.target.value})} style={field}/></label>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(115px,1fr))',gap:10,marginTop:12}}>{importEvents.map(event=><label key={event}>{event==='410'?'.410':event==='doubles'?'Doubles':`${event} gauge`}<input value={row.scores[event]} placeholder="94/100 A" onChange={e=>edit(i,{scores:{...row.scores,[event]:e.target.value}})} style={field}/></label>)}</div>
        </fieldset>;})}</div>
      </div>
      <section style={{padding:20,border:'1px solid #888',borderRadius:10}}><p>{selected.length} shoots selected. Existing records will never be overwritten.</p><button disabled={busy||!rows.length||unresolved||tooMany} onClick={()=>void check()} style={{...button,margin:'12px 0'}}>Check for duplicates</button><label style={{display:'block',margin:'12px 0'}}><input type="checkbox" checked={confirmed} disabled={!checked||busy||invalid||!selected.length||unresolved||tooMany} onChange={e=>setConfirmed(e.target.checked)}/> I checked the selected names, dates, scores, classes, event types, and all warnings against the source.</label><button style={button} disabled={busy||!checked||!confirmed||invalid||!selected.length||unresolved||tooMany} onClick={()=>void commit()}>Import {selected.length} selected shoots</button></section>
    </>}
    <section style={{marginTop:32}}><h2 style={{fontSize:22,fontWeight:600}}>Recent import batches</h2>{profile?.batches.length===0&&<p>No imports yet.</p>}{profile?.batches.map(batch=><article key={batch.id} style={{padding:'16px 0',borderBottom:'1px solid #ccc',overflowWrap:'anywhere'}}><strong>{batch.source}</strong><p>{batch.total} shoots · {new Date(batch.createdAt).toLocaleString()} · {batch.undoneAt?'Undone':'Imported'}</p>{!batch.undoneAt&&<button disabled={busy} onClick={()=>void undo(batch)} style={{padding:'8px 0',textDecoration:'underline'}}>Undo this import</button>}</article>)}</section>
  </main>;
}
