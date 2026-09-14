import { boundedBody } from './upload-body';
import { OWNER_EMAIL, OWNER_ID } from './accounts';
import { extractImage } from './image-extraction';

// Fixed application tables only: this endpoint never accepts SQL or table names.
export const columns: Record<string, string[]> = {
  users: ['id','email','display_name','role','disabled','created_at','support_access_acknowledged_at'],
  invitations: ['id','email','digest','created_by','created_at','expires_at','revoked_at','redeemed_at','email_status','sent_at','redeemed_by'],
  user_class_settings: ['user_id','event','starting_class'],
  account_migrations: ['key','user_id','completed_at'],
  admin_audit: ['id','actor_id','target_id','action','entity_id','before_json','after_json','created_at'],
  import_batches: ['id','owner_id','actor_id','source','digest','created_at','undone_at','total'],
  shoots: ['id','owner_id','import_batch_id','import_key','shoot_number','name','date','status'],
  event_scores: ['id','shoot_id','event','broken','targets','class_shot','shot_date','sequence','label'],
  shoot_notes: ['shoot_id','content','created_at','updated_at'],
  import_records: ['batch_id','shoot_id','snapshot'],
  class_settings: ['event','starting_class'],
  login_challenges: ['id','email','digest','invitation_id','display_name','expires_at','attempts','consumed','created_at'],
  login_sessions: ['digest','email','expires_at','created_at'],
  login_limits: ['key','count','expires_at'],
};
type Row = Record<string, string | number | null>;
export type Snapshot = { tables: Record<string, Row[]> };
export interface RolloutEnv {
  DB: D1Database;
  APP_ORIGIN?: string;
  ROLLOUT_MODE?: string;
  ROLLOUT_TOKEN?: string;
  ROLLOUT_EXPIRES_AT?: string;
  ROLLOUT_SOURCE_SHA256?: string;
  AUTH_SECRET?: string;
  RESEND_API_KEY?: string;
  OPENAI_API_KEY?: string;
}
const marker = 'test-to-production-v1';
const reply = (value: unknown, status = 200) => Response.json(value, {status, headers:{'Cache-Control':'no-store'}});
const hex = (value: ArrayBuffer) => Array.from(new Uint8Array(value), b=>b.toString(16).padStart(2,'0')).join('');
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value==='object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
export async function fingerprint(snapshot: Snapshot) {
  const tables = Object.fromEntries(Object.entries(snapshot.tables).sort(([a],[b])=>a.localeCompare(b)).map(([name, rows])=>[name, rows.map(canonical).sort()]));
  return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(tables))));
}
export async function exportSnapshot(db: D1Database): Promise<Snapshot> {
  const names = await db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all<{name:string}>();
  const available = new Set(names.results.map(r=>r.name));
  const tables: Snapshot['tables'] = {};
  const selected = Object.keys(columns).filter(name=>available.has(name));
  // A D1 batch supplies one consistent transaction across all application tables.
  const results = await db.batch(selected.map(name=>db.prepare(`SELECT * FROM ${name}`)));
  selected.forEach((name,index)=>{tables[name]=results[index].results as Row[];});
  return {tables};
}
function validate(snapshot: Snapshot) {
  if (!snapshot || typeof snapshot.tables!=='object' || !snapshot.tables) throw Error('Invalid snapshot.');
  for (const [table, rows] of Object.entries(snapshot.tables)) {
    if (!Object.hasOwn(columns,table) || !Array.isArray(rows) || rows.length>10000) throw Error('Invalid snapshot table.');
    for (const row of rows) {
      if (!row || typeof row!=='object' || Array.isArray(row)) throw Error('Invalid snapshot row.');
      for (const [key,value] of Object.entries(row)) {
        if (!columns[table].includes(key) || (value!==null && typeof value!=='string' && !(typeof value==='number' && Number.isFinite(value)))) throw Error('Invalid snapshot value.');
      }
    }
  }
}
export function transferPlan(source: Snapshot, target: Snapshot, now: number) {
  validate(source); validate(target);
  if (target.tables.users?.length || target.tables.account_migrations?.length || target.tables.import_batches?.length) throw Error('Production already contains accounts or a migration.');
  const owner=source.tables.users?.find(r=>r.id===OWNER_ID);
  if (!owner || owner.email!==OWNER_EMAIL || owner.role!=='admin' || owner.disabled!==0) throw Error('The designated owner is missing or disabled.');
  const live=target.tables.shoots??[];
  if(live.some(r=>r.owner_id!==null && r.owner_id!==undefined)) throw Error('Production already has assigned records.');
  const shootOffset=Math.max(0,...live.map(r=>Number(r.id)));
  const scoreOffset=Math.max(0,...(target.tables.event_scores??[]).map(r=>Number(r.id)));
  const id=(value: Row[string])=>{if(!Number.isSafeInteger(Number(value)) || Number(value)<1)throw Error('Invalid record identifier.');return Number(value)+shootOffset;};
  const tables: Snapshot['tables']={};
  // No sessions or verification challenges move between origins. Historical
  // invitations remain visible; outstanding links are revoked under the new key.
  for(const name of ['users','invitations','user_class_settings','admin_audit','import_batches','shoots','event_scores','shoot_notes','import_records']) {
    tables[name]=(source.tables[name]??[]).map(original=>{
      const row={...original};
      if(name==='shoots') row.id=id(row.id);
      if(['event_scores','shoot_notes','import_records'].includes(name))row.shoot_id=id(row.shoot_id);
      if(name==='event_scores') row.id=Number(row.id)+scoreOffset;
      if(name==='admin_audit' && String(row.action).startsWith('shoot.') && row.entity_id!==null)row.entity_id=String(id(row.entity_id));
      if(name==='invitations' && row.redeemed_at===null && row.revoked_at===null)row.revoked_at=now;
      return row;
    });
  }
  // The established live class settings take precedence for James only.
  const liveClasses=target.tables.class_settings??[];
  tables.user_class_settings=tables.user_class_settings.filter(r=>r.user_id!==OWNER_ID || !liveClasses.some(c=>c.event===r.event));
  tables.user_class_settings.push(...liveClasses.map(r=>({user_id:OWNER_ID,event:r.event,starting_class:r.starting_class})));
  // Preserve historical migration markers without re-running them on live data.
  tables.account_migrations=(source.tables.account_migrations??[]).filter(r=>r.key!=='legacy-owner-v1' && r.key!==marker).map(r=>({...r}));
  tables.account_migrations.push({key:'legacy-owner-v1',user_id:OWNER_ID,completed_at:now},{key:marker,user_id:OWNER_ID,completed_at:now});
  const shootIds=[...tables.shoots.map(r=>Number(r.id)),...tables.import_records.map(r=>Number(r.shoot_id)),...tables.admin_audit.filter(r=>String(r.action).startsWith('shoot.')&&r.entity_id!==null).map(r=>Number(r.entity_id))];
  const nextShootSequence=Math.max(shootOffset,...shootIds);
  return {tables,shootOffset,scoreOffset,nextShootSequence,liveShootCount:live.length};
}
export async function applyTransfer(db: D1Database, source: Snapshot, expectedTarget: string, now=Date.now()) {
  if(await db.prepare('SELECT key FROM account_migrations WHERE key=?').bind(marker).first()) return {alreadyApplied:true};
  const target=await exportSnapshot(db);
  if(await fingerprint(target)!==expectedTarget)throw Error('Production changed after backup. Export and review again.');
  const plan=transferPlan(source,target,now);
  const statements: D1PreparedStatement[]=[];
  // Competing apply calls must fail atomically, never double-insert.
  statements.push(db.prepare("SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM users) AND NOT EXISTS (SELECT 1 FROM account_migrations) THEN 1 ELSE json('migration-conflict') END"));
  const insert=(name:string,row:Row)=>{
    const keys=columns[name].filter(key=>Object.hasOwn(row,key));
    return db.prepare(`INSERT INTO ${name} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).bind(...keys.map(key=>row[key]));
  };
  for(const name of ['users','invitations','user_class_settings','admin_audit','import_batches','shoots','event_scores','shoot_notes','import_records','account_migrations']) {
    for(const row of plan.tables[name])statements.push(insert(name,row));
  }
  statements.push(db.prepare('UPDATE shoots SET owner_id=? WHERE owner_id IS NULL').bind(OWNER_ID));
  statements.push(db.prepare("UPDATE sqlite_sequence SET seq=MAX(seq,?) WHERE name='shoots'").bind(plan.nextShootSequence));
  await db.batch(statements);
  return {alreadyApplied:false,liveShoots:plan.liveShootCount,transferredShoots:plan.tables.shoots.length,shootOffset:plan.shootOffset,scoreOffset:plan.scoreOffset};
}
export async function rolloutGate(request:Request,env:RolloutEnv):Promise<Response|null> {
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/api/maintenance/')) {
    if(env.ROLLOUT_MODE==='locked')return reply({error:'Skeet Tracker is being updated. Your records are safe. Please try again shortly.'},503);
    if(env.ROLLOUT_MODE==='moved')return new Response(null,{status:303,headers:{Location:'https://sk33t.net/login','Cache-Control':'no-store'}});
    return null;
  }
  // Disabled by default; credentials expire even if cleanup is interrupted.
  if(!['locked','moved'].includes(env.ROLLOUT_MODE??'') || !env.ROLLOUT_TOKEN || env.ROLLOUT_TOKEN.length<48 || !(Date.parse(env.ROLLOUT_EXPIRES_AT??'')>Date.now()))return reply({error:'Not found.'},404);
  const supplied=request.headers.get('authorization')??'';
  const hash=async(text:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
  const [a,b]=await Promise.all([hash(supplied),hash('Bearer '+env.ROLLOUT_TOKEN)]);
  if(a.reduce((n,v,i)=>n|(v^b[i]),0)!==0)return reply({error:'Unauthorized.'},401);
  try {
    if(path==='/api/maintenance/export' && request.method==='GET') {
      const snapshot=await exportSnapshot(env.DB);return reply({...snapshot,sha256:await fingerprint(snapshot)});
    }
    if(path==='/api/maintenance/config' && request.method==='GET')return reply({origin:env.APP_ORIGIN,login:!!env.AUTH_SECRET,email:!!env.RESEND_API_KEY,images:!!env.OPENAI_API_KEY});
    if(path==='/api/maintenance/verify-keys' && request.method==='POST') {
      const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,200000))) as {service:string;image?:string};
      if(body.service==='email' && env.RESEND_API_KEY) {
        const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':'skeet-production-rollout-key-check-2026-09-14'},body:JSON.stringify({from:'Skeet Tracker <login@sk33t.net>',to:[OWNER_EMAIL],reply_to:OWNER_EMAIL,subject:'Skeet Tracker — production email check',text:'This is the production email check you requested. Email delivery is configured for sk33t.net. Your records have not been changed by this check.'}),signal:AbortSignal.timeout(15000)});
        return reply({service:'email',accepted:response.ok,status:response.status},response.ok?200:502);
      }
      if(body.service==='images' && env.OPENAI_API_KEY && body.image?.startsWith('data:image/png;base64,')) {
        const result=await extractImage(body.image,env.OPENAI_API_KEY);return reply({service:'images',rows:result.rows});
      }
      return reply({error:'Service is missing or request is invalid.'},400);
    }
    if(path==='/api/maintenance/transfer' && request.method==='POST' && env.APP_ORIGIN==='https://sk33t.net' && env.ROLLOUT_MODE==='locked') {
      if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required.'},415);
      const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,4*1024*1024))) as {source:Snapshot;expectedTarget:string};
      validate(body.source);
      if(!env.ROLLOUT_SOURCE_SHA256 || await fingerprint(body.source)!==env.ROLLOUT_SOURCE_SHA256)return reply({error:'Source does not match the verified backup.'},409);
      const result=await applyTransfer(env.DB,body.source,body.expectedTarget);return reply(result);
    }
    return reply({error:'Not found.'},404);
  } catch {return reply({error:'Transfer was not completed. Check the backup and retry only after review.'},409);}
}
