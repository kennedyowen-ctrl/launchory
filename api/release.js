import {db,stripe,authorized,respond,safeError} from './_shared.js';
export default async function handler(req,res){
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
 try{
  const user=await authorized(req);if(!user)return respond(res,401,{error:'Sign in required'});
  const id=req.body?.proposal_id;if(typeof id!=='string'||!/^[-a-f0-9]{36}$/i.test(id))return respond(res,400,{error:'Invalid proposal'});
  const store=db();
  const {data:p}=await store.from('proposals').select('id,creative_id,project_id,status').eq('id',id).maybeSingle();
  if(!p||p.status!=='accepted')return respond(res,409,{error:'Accepted proposal required'});
  const {data:project}=await store.from('projects').select('founder_id').eq('id',p.project_id).maybeSingle();
  if(project?.founder_id!==user.id)return respond(res,403,{error:'Founder approval required'});
  const {data:payment}=await store.from('payments').select('*').eq('proposal_id',id).maybeSingle();
  if(!payment)return respond(res,409,{error:'No confirmed payment'});
  if(payment.status==='transferred'){await store.from('projects').update({status:'completed'}).eq('id',p.project_id).eq('status','in_progress');return respond(res,200,{status:'transferred'});}
  if(!['paid','transferring'].includes(payment.status)||!payment.payment_intent_id)return respond(res,409,{error:'Payment not ready'});
  const {data:creative}=await store.from('profiles').select('stripe_account_id').eq('id',p.creative_id).maybeSingle();
  if(!creative?.stripe_account_id)return respond(res,409,{error:'Payout account not ready'});
  if(payment.status==='paid'){const {data:claimed}=await store.from('payments').update({status:'transferring',approved_at:new Date().toISOString()}).eq('id',payment.id).eq('status','paid').select('id').maybeSingle();if(!claimed)return respond(res,409,{error:'Transfer already processing'});}
  const client=stripe();
  const intent=await client.paymentIntents.retrieve(payment.payment_intent_id,{expand:['latest_charge']});
  if(intent.status!=='succeeded'||!intent.latest_charge?.id||intent.latest_charge.refunded||intent.latest_charge.disputed)return respond(res,409,{error:'Charge is not eligible for release'});
  const transfer=await client.transfers.create({amount:payment.amount_cents-payment.fee_cents,currency:'usd',destination:creative.stripe_account_id,
   source_transaction:intent.latest_charge.id,transfer_group:'launchory_'+id,metadata:{proposal_id:id,payment_id:payment.id}},
   {idempotencyKey:'launchory_release_'+payment.id});
  const {error:saveError}=await store.from('payments').update({status:'transferred',transfer_id:transfer.id}).eq('id',payment.id);
  if(saveError)throw saveError;
  const {error:projectError}=await store.from('projects').update({status:'completed'}).eq('id',p.project_id).eq('status','in_progress');
  if(projectError)throw projectError;
  return respond(res,200,{status:'transferred'});
 }catch(e){return respond(res,safeError(e),{error:'Release needs review. Please contact Launchory support before retrying.'});}
}