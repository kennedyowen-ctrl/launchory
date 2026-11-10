import {db,stripe,authorized,respond,origin,safeError} from './_shared.js';
export default async function handler(req,res){
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
 try{
  const user=await authorized(req);if(!user)return respond(res,401,{error:'Sign in required'});
  const store=db();const {data:p,error}=await store.from('profiles').select('role,stripe_account_id').eq('id',user.id).single();
  if(error||p?.role!=='creative')return respond(res,403,{error:'Creative account required'});
  const client=stripe();let id=p.stripe_account_id;
  if(!id){const a=await client.accounts.create({type:'express',country:'US',email:user.email,capabilities:{transfers:{requested:true}}},{idempotencyKey:'creative_'+user.id});id=a.id;
   const {error:updateError}=await store.from('profiles').update({stripe_account_id:id}).eq('id',user.id);if(updateError)throw updateError;}
  const link=await client.accountLinks.create({account:id,refresh_url:origin()+'/marketplace.html#payments',return_url:origin()+'/marketplace.html#payments',type:'account_onboarding'});
  return respond(res,200,{url:link.url});
 }catch(e){return respond(res,safeError(e),{error:'Unable to begin payout onboarding. Please try again later.'});}
}