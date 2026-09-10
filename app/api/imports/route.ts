import { env } from "cloudflare:workers";
import { requestAccount } from "@/lib/request-account";
import { csvDraft,type DraftRow } from "@/lib/import-format";
import { inspectImport,commitImport,undoImport } from "@/lib/import-storage";
import { boundedBody } from "@/lib/upload-body";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request){const account=await requestAccount(request,true);if(account instanceof Response)return account;
  try{const batches=await env.DB.prepare("SELECT id,source,created_at AS createdAt,total,undone_at AS undoneAt FROM import_batches WHERE owner_id=? ORDER BY created_at DESC LIMIT 50").bind(account.id).all();return json({batches:batches.results,imageEnabled:!!(env as unknown as {OPENAI_API_KEY?:string}).OPENAI_API_KEY,account:{name:account.displayName,email:account.email,support:!!account.actorId}});}catch{return json({error:"Unable to load imports."},503);}
}
export async function POST(request:Request){const account=await requestAccount(request,true);if(account instanceof Response)return account;
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:"JSON required."},415);
  let text:string;try{text=new TextDecoder().decode(await boundedBody(request,700000));}catch{return json({error:"Upload is too large. Import up to 100 shoots at a time."},413);}
  try{const body=JSON.parse(text) as {action:string;csv?:string;rows?:DraftRow[];id?:string;source?:string;reviewed?:boolean};
    if(body.action==='csv'){if(typeof body.csv!=='string')throw Error("Choose a CSV file.");return json({rows:csvDraft(body.csv)});}
    if(body.action==='inspect')return json({checks:await inspectImport(account,body.rows!)});
    if(body.action==='commit'){if(body.reviewed!==true)throw Error("Review and confirm the selected records first.");return json(await commitImport(account,body.id??'',body.source??'Upload',body.rows!));}
    if(body.action==='undo')return json(await undoImport(account,body.id??''));
    return json({error:"Unknown import action."},400);
  }catch(e){const raw=e instanceof Error?e.message:'';const message=/SQLITE|D1_|constraint|UNIQUE/i.test(raw)?"The records changed during this import. Refresh and review again; no partial import was saved.":raw||"Unable to process the import.";return json({error:message},400);}
}
