import { validateNotes } from "@/lib/shoot-notes";
import { attachScores } from "@/lib/tracker-data";
import { asc, eq, and } from "drizzle-orm";
import { requestAccount } from "@/lib/request-account";
import { mutateShoot } from "@/lib/shoot-mutations";
import { getDb } from "@/db";
import { shoots } from "@/db/schema";
const events=["12","20","28","410","doubles"];
type Entry={event:string;broken:number;targets:number;label?:string;classShot?:string;shotDate?:string};
type Body={id?:number;name:string;date:string;status?:string;entries?:Entry[];notes?:string};
function input(body:Body,creating:boolean) {
  if(!body || typeof body.name!=="string" || !body.name.trim() || !body.date || (!creating&&!Number.isInteger(body.id))) throw Error("Valid shoot, name, and date are required");
  const notes=validateNotes(body.notes);
  const entries=body.entries===undefined?(creating?[]:undefined):body.entries.filter(e=>events.includes(e.event)&&Number.isInteger(e.broken)&&Number.isInteger(e.targets)&&e.broken>=0&&e.targets>0&&e.broken<=e.targets);
  return {name:body.name.trim(),date:body.date,status:["in_progress","complete"].includes(body.status??"")?body.status!:(creating?"in_progress":"complete"),entries,notes};
}
export async function GET(request:Request) {
  const account=await requestAccount(request,true);if(account instanceof Response)return account;
  try {const rows=await getDb().select().from(shoots).where(eq(shoots.ownerId,account.id)).orderBy(asc(shoots.date),asc(shoots.id));return Response.json({shoots:await attachScores(rows)});}
  catch {return Response.json({error:"Unable to load shoots."},{status:500});}
}
async function save(request:Request,creating:boolean) {
  const account=await requestAccount(request,true);if(account instanceof Response)return account;
  let body:Body,values;
  try {body=await request.json() as Body;values=input(body,creating);}catch(e){return Response.json({error:e instanceof Error?e.message:"Invalid shoot."},{status:400});}
  try {
    if(!creating){const [owned]=await getDb().select({id:shoots.id}).from(shoots).where(and(eq(shoots.id,body.id!),eq(shoots.ownerId,account.id)));if(!owned)return Response.json({error:"Shoot not found."},{status:404});}
    const shoot=await mutateShoot(account,creating?"create":"update",creating?null:body.id!,values);
    return Response.json(creating?{shoot}:{ok:true},{status:creating?201:200});
  }catch {return Response.json({error:"Unable to save shoot. No changes were saved. Please retry."},{status:500});}
}
export const POST=(request:Request)=>save(request,true);
export const PATCH=(request:Request)=>save(request,false);
export async function DELETE(request:Request) {
  const account=await requestAccount(request,true);if(account instanceof Response)return account;
  const id=Number(new URL(request.url).searchParams.get("id"));if(!Number.isInteger(id)||id<=0)return Response.json({error:"Valid shoot is required."},{status:400});
  try {
    const [owned]=await getDb().select({id:shoots.id}).from(shoots).where(and(eq(shoots.id,id),eq(shoots.ownerId,account.id)));if(!owned)return Response.json({error:"Shoot not found."},{status:404});
    await mutateShoot(account,"delete",id);return Response.json({ok:true});
  }catch {return Response.json({error:"Unable to delete shoot. No changes were saved. Please retry."},{status:500});}
}
