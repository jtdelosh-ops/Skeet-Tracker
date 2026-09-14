import { env } from "cloudflare:workers";
import { auditMutation } from "./admin-audit";
import type { Account } from "./accounts";
import { validateImportRow,type DraftRow,type ImportRow } from "./import-format";
export const importSnapshot=`json_object('name',s.name,'date',s.date,'number',s.shoot_number,'status',s.status,'scores',json((SELECT json_group_array(json_object('event',event,'broken',broken,'targets',targets,'class',class_shot,'date',shot_date,'label',label,'sequence',sequence)) FROM (SELECT * FROM event_scores WHERE shoot_id=s.id ORDER BY sequence,id))),'notes',(SELECT content FROM shoot_notes WHERE shoot_id=s.id))`;
const duplicateSQL="SELECT id FROM shoots WHERE owner_id=? AND (import_key=? OR (? IS NOT NULL AND shoot_number=?) OR (date=? AND lower(trim(name))=?)) LIMIT 1";
const duplicateArgs=(account:Account,row:ImportRow)=>[account.id,row.key,row.shootNumber,row.shootNumber,row.date,row.name.toLowerCase()] as const;
export async function inspectImport(account:Account,rows:DraftRow[]) {
  if(!Array.isArray(rows)||!rows.length||rows.length>100)throw Error("Review between 1 and 100 shoots.");const seen=new Set<string>();
  return Promise.all(rows.map(async(row)=>{try{const parsed=validateImportRow(row);const repeated=seen.has(parsed.key);seen.add(parsed.key);const duplicate=await env.DB.prepare(duplicateSQL).bind(...duplicateArgs(account,parsed)).first<{id:number}>();return {error:null,duplicate:repeated?"Repeated in this upload":duplicate?`Matches existing shoot #${duplicate.id}`:null};}catch(e){return {error:e instanceof Error?e.message:"Invalid row.",duplicate:null};}}));
}
export async function commitImport(account:Account,id:string,source:string,drafts:DraftRow[]) {
  if(!/^[a-f0-9-]{36}$/.test(id))throw Error("Invalid import request.");
  if(!Array.isArray(drafts)||!drafts.length||drafts.length>100)throw Error("Import between 1 and 100 shoots.");
  const rows=drafts.map(validateImportRow);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows)))),b=>b.toString(16).padStart(2,'0')).join('');
  const existing=await env.DB.prepare("SELECT total,digest,undone_at FROM import_batches WHERE id=? AND owner_id=? AND actor_id=?").bind(id,account.id,account.actorId??account.id).first<{total:number;digest:string;undone_at:number|null}>();
  if(existing){if(existing.digest!==digest)throw Error("This import request was already used with different records. Review again.");return {id,total:existing.total,undone:existing.undone_at!==null};}
  const check=await inspectImport(account,drafts);if(check.some(r=>r.error||r.duplicate))throw Error("The upload contains invalid or duplicate shoots. Review it again before importing.");
  const db=env.DB,statements:D1PreparedStatement[]=[db.prepare("INSERT INTO import_batches(id,owner_id,actor_id,source,digest,created_at,total) VALUES (?,?,?,?,?,?,?)").bind(id,account.id,account.actorId??account.id,source.slice(0,200),digest,Date.now(),rows.length)];
  for(const row of rows){
    // Fail the whole transaction if a matching record appeared after preview.
    statements.push(db.prepare(`UPDATE import_batches SET total=-1 WHERE id=? AND EXISTS (${duplicateSQL})`).bind(id,...duplicateArgs(account,row)));
    statements.push(db.prepare("INSERT INTO shoots(owner_id,shoot_number,name,date,status,import_batch_id,import_key) VALUES (?,?,?,?,'complete',?,?)").bind(account.id,row.shootNumber,row.name,row.date,id,row.key));
    const audit=auditMutation(db,account,"shoot.create",null,"shoot",true);statements.push(...audit.before);
    for(const [sequence,entry] of row.entries.entries())statements.push(db.prepare("INSERT INTO event_scores(shoot_id,event,broken,targets,class_shot,shot_date,label,sequence) SELECT id,?,?,?,?,?,?,? FROM shoots WHERE owner_id=? AND import_batch_id=? AND import_key=?").bind(entry.event,entry.broken,entry.targets,entry.classShot,row.date,entry.label,sequence,account.id,id,row.key));
    statements.push(...audit.after,db.prepare(`INSERT INTO import_records(batch_id,shoot_id,snapshot) SELECT ?,s.id,${importSnapshot} FROM shoots s WHERE s.owner_id=? AND s.import_batch_id=? AND s.import_key=?`).bind(id,account.id,id,row.key));
  }
  await db.batch(statements);return {id,total:rows.length,undone:false};
}
export async function undoImport(account:Account,id:string){
  const db=env.DB,batch=await db.prepare("SELECT id,undone_at FROM import_batches WHERE id=? AND owner_id=?").bind(id,account.id).first<{id:string;undone_at:number|null}>();
  if(!batch)throw Error("Import batch not found.");if(batch.undone_at!==null)return {ok:true};
  const modified=`SELECT 1 FROM import_records r JOIN shoots s ON s.id=r.shoot_id WHERE r.batch_id=? AND (s.owner_id<>? OR ${importSnapshot}<>r.snapshot)`;
  if(await db.prepare(modified).bind(id,account.id).first())throw Error("Some imported records have been edited. Undo is blocked to preserve those changes; review them in your tracker.");
  const rows=await db.prepare("SELECT id FROM shoots WHERE import_batch_id=? AND owner_id=?").bind(id,account.id).all<{id:number}>();
  const statements=[db.prepare(`UPDATE import_batches SET total=-1 WHERE id=? AND EXISTS (${modified})`).bind(id,id,account.id)];
  for(const row of rows.results){const audit=auditMutation(db,account,"shoot.delete",row.id,"shoot");statements.push(...audit.before,db.prepare("DELETE FROM shoot_notes WHERE shoot_id=?").bind(row.id),db.prepare("DELETE FROM event_scores WHERE shoot_id=?").bind(row.id),db.prepare("DELETE FROM shoots WHERE id=? AND owner_id=? AND import_batch_id=?").bind(row.id,account.id,id),...audit.after);}
  statements.push(db.prepare("UPDATE import_batches SET undone_at=? WHERE id=? AND owner_id=?").bind(Date.now(),id,account.id));await db.batch(statements);return {ok:true};
}
