export const importEvents=["12","20","28","410","doubles"] as const;
export type ImportEvent=typeof importEvents[number];
export type DraftRow={shootNumber:string;date:string;name:string;label:string;scores:Record<ImportEvent,string>;warnings:string[]};
export type ImportEntry={event:ImportEvent;broken:number;targets:number;classShot:string|null;label:string};
export type ImportRow={shootNumber:number|null;date:string;name:string;label:string;entries:ImportEntry[];key:string};
export const emptyScores=()=>({'12':'','20':'','28':'','410':'',doubles:''});
export function normalizeImportScore(value:string):string {
 return /^0\s*\/\s*0(?:\s+(?:AAA|AA|A|B|C|D|E|N))?$/i.test(value.trim())?'':value.trim();
}
export function normalizeImportDraft(row:DraftRow):DraftRow {
 return {...row,scores:Object.fromEntries(importEvents.map(event=>[event,normalizeImportScore(row.scores[event])])) as Record<ImportEvent,string>};
}
export function parseCsv(text:string):string[][] {
  if(text.length>500000)throw Error("CSV files must be 500 KB or smaller.");
  text=text.replace(/^\uFEFF/,"");const rows:string[][]=[];let row:string[]=[],cell="",quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c==='"'){if(cell||closed)throw Error("Malformed CSV quotes.");quoted=true;continue;}
    if(c===','||c==='\n'||c==='\r'){row.push(cell);cell="";closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v.trim()))rows.push(row);row=[];}continue;}
    if(closed&&!/\s/.test(c))throw Error("Unexpected text after a quoted CSV cell.");if(!closed)cell+=c;
  }
  if(quoted)throw Error("CSV contains an unclosed quoted cell.");row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length>101)throw Error("Import up to 100 shoots at a time.");return rows;
}
const header=(v:string)=>v.trim().toLowerCase().replace(/[^a-z0-9]/g,"");
export function csvDraft(text:string):DraftRow[]{
  const [rawHeaders,...rows]=parseCsv(text);if(!rawHeaders||!rows.length)throw Error("The CSV needs a header row and at least one shoot.");
  const heads=rawHeaders.map(header);if(new Set(heads).size!==heads.length)throw Error("The CSV has duplicate column headings.");
  const column=(aliases:string[])=>heads.findIndex(h=>aliases.includes(h));
  const name=column(['shootname','name']),date=column(['date','shootdate']),number=column(['shoot','shootnumber','nssashootnumber']),type=column(['eventtype','type','label']);
  if(name<0||date<0)throw Error("Include Shoot Name and Date columns. Download the template for the supported layout.");
  const eventAliases=(e:ImportEvent)=>e==='doubles'?['doubles','dbls','dbl']:e==='410'?['410','410ga','410gauge']: [e,e+'ga',e+'gauge'];
  if(!importEvents.some(e=>heads.some(h=>eventAliases(e).includes(h)||h===e+'broken')))throw Error("No score columns found. Use 12, 20, 28, 410, Doubles, or separate Broken/Targets/Class columns.");
  return rows.map((r,i)=>{
    if(r.length!==heads.length)throw Error(`CSV row ${i+2} has ${r.length} cells; expected ${heads.length}.`);
    const scores=emptyScores();
    for(const e of importEvents){const combined=column(eventAliases(e)),broken=column([e+'broken']),targets=column([e+'targets']),cls=column([e+'class']);
      if(combined>=0)scores[e]=r[combined].trim();else if(broken>=0||targets>=0){const b=broken>=0?r[broken].trim():'',t=targets>=0?r[targets].trim():'';scores[e]=b||t?`${b}/${t}${cls>=0&&r[cls].trim()?' '+r[cls].trim():''}`:'';}
    }
    return normalizeImportDraft({shootNumber:number>=0?r[number].trim():'',date:r[date].trim(),name:r[name].trim(),label:type>=0?r[type].trim():'',scores,warnings:[]});
  });
}
export function normalizeDate(value:string){
  const text=value.trim();let iso=text;
  const us=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);if(us)iso=`${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!Number.isFinite(Date.parse(iso))||new Date(iso).toISOString().slice(0,10)!==iso)throw Error("Use a valid date in YYYY-MM-DD or MM/DD/YYYY format.");return iso;
}
export function validateImportRow(value:unknown):ImportRow {
  const row=value as DraftRow;if(!row||typeof row!=='object'||typeof row.name!=='string'||!row.name.trim()||row.name.length>200)throw Error("Enter a shoot name (up to 200 characters).");
  if(typeof row.date!=='string')throw Error("Enter the shoot date.");const date=normalizeDate(row.date);
  if(typeof row.shootNumber!=='string'||(row.shootNumber.trim()&&!/^\d{1,9}$/.test(row.shootNumber.trim())))throw Error("Shoot number must be blank or a positive whole number.");
  const shootNumber=row.shootNumber.trim()?Number(row.shootNumber):null;if(shootNumber===0)throw Error("Shoot number must be positive.");
  const label=row.label?.toLowerCase()==='main'?'Main':row.label?.toLowerCase()==='preliminary'?'Preliminary':null;if(!label)throw Error("Choose Main or Preliminary; the source may not specify this.");
  const entries:ImportEntry[]=[];
  for(const event of importEvents){const cell=row.scores?.[event];if(typeof cell!=='string')throw Error(`Invalid ${event} score.`);const score=normalizeImportScore(cell);if(!score)continue;
    const m=/^(\d+)\s*\/\s*(\d+)(?:\s+(AAA|AA|A|B|C|D|E|N))?$/i.exec(score);if(!m)throw Error(`${event}: use broken/targets and optional class, for example 94/100 A.`);
    const broken=Number(m[1]),targets=Number(m[2]),classShot=m[3]?.toUpperCase()??null;if(targets<=0||targets>10000||broken>targets)throw Error(`${event}: check broken targets and total targets.`);if(classShot==='E'&&event!=='12')throw Error(`${event}: class E is only valid for 12 gauge.`);
    entries.push({event,broken,targets,classShot,label});
  }
  if(!entries.length)throw Error("Enter at least one event score.");
  const name=row.name.trim();return {shootNumber,date,name,label,entries,key:shootNumber?`nssa:${shootNumber}`:`name:${date}:${name.toLowerCase().replace(/\s+/g,' ')}`};
}
