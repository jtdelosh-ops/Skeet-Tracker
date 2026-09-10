import { env } from "cloudflare:workers";
import { auditMutation } from "./admin-audit";
import type { Account } from "./accounts";
type Entry={event:string;broken:number;targets:number;label?:string;classShot?:string;shotDate?:string};
type Input={name:string;date:string;status:string;entries?:Entry[];notes?:string};
export async function mutateShoot(account:Account,action:"create"|"update"|"delete",id:number|null,input?:Input) {
  const db=env.DB;
  // MAX(id) is the just-created parent within this serialized D1 batch. Child
  // inserts touch other tables, and no other transaction can interleave here.
  const parent=action==="create"?"(SELECT MAX(id) FROM shoots)":String(id);
  const audit=auditMutation(db,account,`shoot.${action}`,id,"shoot",action==="create");
  const statements:D1PreparedStatement[]=[];
  if(action==="create") statements.push(db.prepare("INSERT INTO shoots(owner_id,name,date,status) VALUES (?,?,?,?) RETURNING id,owner_id AS ownerId,name,date,status,shoot_number AS shootNumber").bind(account.id,input!.name,input!.date,input!.status));
  statements.push(...audit.before);
  if(action==="delete") {
    statements.push(db.prepare("DELETE FROM shoot_notes WHERE shoot_id=?").bind(id),db.prepare("DELETE FROM event_scores WHERE shoot_id=?").bind(id),db.prepare("DELETE FROM shoots WHERE id=? AND owner_id=?").bind(id,account.id));
  } else {
    if(action==="update")statements.push(db.prepare("UPDATE shoots SET name=?,date=?,status=? WHERE id=? AND owner_id=?").bind(input!.name,input!.date,input!.status,id,account.id));
    if(input!.entries!==undefined) {
      if(action==="update")statements.push(db.prepare("DELETE FROM event_scores WHERE shoot_id=?").bind(id));
      for(const [sequence,entry] of input!.entries.entries())statements.push(db.prepare(`INSERT INTO event_scores(shoot_id,event,broken,targets,sequence,label,class_shot,shot_date) VALUES (${parent},?,?,?,?,?,?,?)`).bind(entry.event,entry.broken,entry.targets,sequence,entry.label?.trim()||"Main",entry.classShot?.trim()||null,entry.shotDate||input!.date));
    }
    if(input!.notes!==undefined) {
      if(!input!.notes)statements.push(db.prepare(`DELETE FROM shoot_notes WHERE shoot_id=${parent}`));
      else {const now=new Date().toISOString();statements.push(db.prepare(`INSERT INTO shoot_notes(shoot_id,content,created_at,updated_at) VALUES (${parent},?,?,?) ON CONFLICT(shoot_id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at WHERE shoot_notes.content<>excluded.content`).bind(input!.notes,now,now));}
    }
  }
  statements.push(...audit.after);
  const results=await db.batch(statements);
  return action==="create"?results[0].results[0]:null;
}
