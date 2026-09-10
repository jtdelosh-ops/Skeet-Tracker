import { env } from "cloudflare:workers";
import { requestAccount } from "@/lib/request-account";
import { limit,type LoginEnv } from "@/lib/login";
import { extractImage } from "@/lib/image-extraction";
import { boundedBody } from "@/lib/upload-body";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
  const account=await requestAccount(request,true);if(account instanceof Response)return account;
  const runtime=env as unknown as LoginEnv&{OPENAI_API_KEY?:string};if(!runtime.OPENAI_API_KEY)return json({error:'Screenshot extraction is not configured yet. CSV import is available.'},503);
  if(!request.headers.get('content-type')?.includes('multipart/form-data'))return json({error:'Choose a PNG, JPEG, or WebP image.'},415);
  if(Number(request.headers.get('content-length'))>8500000)return json({error:'Use an image under 8 MB.'},413);
  try{
    const body=await boundedBody(request,8500000);
    const form=await new Response(body,{headers:{'Content-Type':request.headers.get('content-type')!}}).formData(),file=form.get('file');if(!(file instanceof File)||file.size>8000000||file.size===0)return json({error:'Choose an image under 8 MB.'},400);
    const bytes=new Uint8Array(await file.arrayBuffer());const mime=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'?'image/webp':null;
    if(!mime)return json({error:'Only PNG, JPEG, and WebP screenshots or photos are supported.'},415);
    if(!await limit(runtime,`image-user:${account.actorId??account.id}`,10,86400000)||!await limit(runtime,'image-site-day',50,86400000))return json({error:'The daily screenshot-processing limit has been reached. CSV import remains available.'},429);
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return json(await extractImage(`data:${mime};base64,${btoa(binary)}`,runtime.OPENAI_API_KEY));
  }catch(e){return json({error:e instanceof Error?e.message:'Unable to process the screenshot.'},502);}
}
