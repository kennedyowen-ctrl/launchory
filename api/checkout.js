import {db,stripe,authorized,respond,origin,safeError} from './_shared.js';

const uuid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export default async function handler(req,res){
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
 try{
  const user=await authorized(req);
  if(!user)return respond(res,401,{error:'Sign in required'});
  const id=req.body?.proposal_id;
  if(!uuid(id))return respond(res,400,{error:'Invalid proposal'});
  const store=db();
  const {data:p,error:pError}=await store.from('proposals').select('id,amount_cents,status,creative_id,project_id').eq('id',id).maybeSingle();
  if(pError)throw pError;
  if(!p||p.status!=='accepted')return respond(res,409,{error:'An accepted proposal is required'});
  const {data:project,error:projError}=await store.from('projects').select('founder_id,title,status').eq('id',p.project_id).maybeSingle();
  if(projError)throw projError;
  if(project?.founder_id!==user.id)return respond(res,403,{error:'Only the project founder can pay'});
  if(project.status!=='in_progress')return respond(res,409,{error:'This project is not accepting payments'});
  const {data:creative,error:creativeError}=await store.from('profiles').select('stripe_account_id').eq('id',p.creative_id).maybeSingle();
  if(creativeError)throw creativeError;
  if(!creative?.stripe_account_id)return respond(res,409,{error:'Your creative must connect their Stripe payout account first'});
  const client=stripe();
  const acct=await client.accounts.retrieve(creative.stripe_account_id);
  if(!acct.payouts_enabled)return respond(res,409,{error:'Creative payout onboarding has not finished'});
  const {data:existing,error:existingError}=await store.from('payments').select('id,status,checkout_session_id').eq('proposal_id',id).maybeSingle();
  if(existingError)throw existingError;
  if(existing&&existing.status!=='pending')return respond(res,409,{error:'Payment already processed or under review'});
  if(existing?.checkout_session_id){
   const prior=await client.checkout.sessions.retrieve(existing.checkout_session_id);
   if(prior.status==='open'&&prior.url)return respond(res,200,{url:prior.url,reused:true});
   if(prior.status==='complete')return respond(res,409,{error:'Payment already submitted. Check your Payments page for an update.'});
   if(prior.status!=='expired')return respond(res,409,{error:'Checkout is not ready for another attempt'});
  }
  const fee=Math.round(p.amount_cents*.07);
  const previous=existing?.checkout_session_id||'';
  const session=await client.checkout.sessions.create({
   mode:'payment',customer_email:user.email,client_reference_id:id,
   invoice_creation:{enabled:true,invoice_data:{description:'Launchory creative services project'}},
   line_items:[{price_data:{currency:'usd',unit_amount:p.amount_cents,product_data:{name:'Launchory · '+project.title.slice(0,100)}},quantity:1}],
   payment_intent_data:{transfer_group:'launchory_'+id,metadata:{proposal_id:id}},
   success_url:origin()+'/marketplace.html?payment=success#payments',
   cancel_url:origin()+'/marketplace.html?payment=cancelled#inbox',
   metadata:{proposal_id:id}
  },{idempotencyKey:previous?'launchory_retry_'+id+'_'+previous:'launchory_checkout_'+id});
  if(existing){
   const {data:updated,error:updateError}=await store.from('payments')
    .update({checkout_session_id:session.id})
    .eq('id',existing.id).eq('checkout_session_id',previous).eq('status','pending')
    .select('id').maybeSingle();
   if(updateError)throw updateError;
   if(!updated)return respond(res,409,{error:'Another checkout attempt has already started'});
  }else{
   const {error:insertError}=await store.from('payments').insert({
    proposal_id:id,checkout_session_id:session.id,amount_cents:p.amount_cents,fee_cents:fee,status:'pending'
   });
   if(insertError){try{await client.checkout.sessions.expire(session.id)}catch{}return respond(res,409,{error:'Checkout already started in another session'});}
  }
  return respond(res,200,{url:session.url});
 }catch(e){return respond(res,safeError(e),{error:'Unable to open checkout right now. Please try again later.'});}
}
