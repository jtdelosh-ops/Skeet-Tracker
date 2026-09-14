import type { Account } from "./accounts";
// Snapshots run inside the same batch as the mutation, including linked scores
// and notes. A failed audit write rolls back the correction.
const shootSnapshot=`(SELECT json_object('name',s.name,'date',s.date,'status',s.status,
 'scores',json((SELECT json_group_array(json_object('event',event,'broken',broken,'targets',targets,'label',label,'class',class_shot,'date',shot_date,'sequence',sequence)) FROM (SELECT * FROM event_scores WHERE shoot_id=s.id ORDER BY sequence,id))),
 'notes',(SELECT content FROM shoot_notes WHERE shoot_id=s.id)) FROM shoots s WHERE s.id=CAST(admin_audit.entity_id AS INTEGER) AND s.owner_id=admin_audit.target_id)`;
const settingsSnapshot=`(SELECT json_group_object(event,starting_class) FROM user_class_settings WHERE user_id=admin_audit.target_id)`;
const accountSnapshot=`(SELECT json_object('displayName',display_name,'email',email,'disabled',disabled) FROM users WHERE id=admin_audit.target_id)`;
export function auditMutation(db:D1Database,account:Account,action:string,entityId:number|string|null,kind:"shoot"|"settings"|"account",createdShoot=false) {
  if(!account.actorId) return {before:[] as D1PreparedStatement[],after:[] as D1PreparedStatement[]};
  const id=crypto.randomUUID();
  const snapshot=kind==="shoot"?shootSnapshot:kind==="settings"?settingsSnapshot:accountSnapshot;
  const insert=createdShoot
    ?db.prepare("INSERT INTO admin_audit(id,actor_id,target_id,action,entity_id,created_at) VALUES (?,?,?,?,CAST((SELECT MAX(id) FROM shoots) AS TEXT),?)").bind(id,account.actorId,account.id,action,Date.now())
    :db.prepare("INSERT INTO admin_audit(id,actor_id,target_id,action,entity_id,created_at) VALUES (?,?,?,?,?,?)").bind(id,account.actorId,account.id,action,entityId===null?null:String(entityId),Date.now());
  return {before:[insert,...(createdShoot?[]:[db.prepare(`UPDATE admin_audit SET before_json=${snapshot} WHERE id=?`).bind(id)])],after:[db.prepare(`UPDATE admin_audit SET after_json=${snapshot} WHERE id=?`).bind(id)]};
}
