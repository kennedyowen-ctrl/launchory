import {db,stripe,authorized,respond,origin,safeError} from './_shared.js';
export default async function handler(req,res){
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
 try{
  const user=await authorized(req);if(!user)return respond(res,401,{error:'Sign in required'});
  const id=req.body?.proposal_id;if(typeof id!=='string'||!/^[-a-f0-9]{36}$/i.test(id))return respond(res,400,{error:'Invalid proposal'});
  const store=db();
  const {data:p}=await store.from('proposals').select('id,amount_cents,status,creative_id,project_id').eq('id',id).maybeSingle();
  if(!p||p.status!=='accepted')return respond(res,409,{error:'An accepted proposal is required'});
  const {data:project}=await store.from('projects').select('founder_id,title').eq('id',p.project_id).maybeSingle();
  if(project?.founder_id!==user.id)return respond(res,403,{error:'Founder authorization required'});
  const {data:creative}=await store.from('profiles').select('stripe_account_id').eq('id',p.creative_id).maybeSingle();
  if(!creative?.stripe_account_id)return respond(res,409,{error:'Creative needs to finish Stripe onboarding'});
  const client=stripe();const account=await client.accounts.retrieve(creative.stripe_account_id);
  if(!account.payouts_enabled)return respond(res,409,{error:'Creative payout account not ready'});
  const {data:existing}=await store.from('payments').select('status,checkout_session_id').eq('proposal_id',id).maybeSingle();
  if(existing)return respond(res,409,{error:'Checkout is already started. Contact support to retry an expired session.'});
  const fee=Math.round(p.amount_cents*0.07);
  const session=await client.checkout.sessions.create({
   mode:'payment',customer_email:user.email,client_reference_id:id,invoice_creation:{enabled:true,invoice_data:{description:'Launchory creative services project'}},
   line_items:[{price_data:{currency:'usd',unit_amount:p.amount_cents,product_data:{name:'Launchory · '+project.title.slice(0,100)}},quantity:1}],
   payment_intent_data:{transfer_group:'launchory_'+id,metadata:{proposal_id:id}},
   success_url:origin()+'/marketplace.html?payment=success#payments',cancel_url:origin()+'/marketplace.html?payment=cancelled#inbox',
   metadata:{proposal_id:id}
  },{idempotencyKey:'launchory_checkout_'+id});
  const {error}=await store.from('payments').insert({proposal_id:id,checkout_session_id:session.id,amount_cents:p.amount_cents,fee_cents:fee,status:'pending'});
  if(error){try{await client.checkout.sessions.expire(session.id);}catch{}return respond(res,409,{error:'Checkout already exists or cannot be reserved'});}
  return respond(res,200,{url:session.url});
 }catch(e){return respond(res,safeError(e),{error:'Payment checkout is not currently available'});}
}