import {db,stripe,respond} from './_shared.js';
export const config={api:{bodyParser:false}};
async function raw(req){const chunks=[];for await(const c of req)chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c));return Buffer.concat(chunks);}
export default async function handler(req,res){
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
 if(!process.env.STRIPE_WEBHOOK_SECRET)return respond(res,503,{error:'Webhook not configured'});
 let event;
 try{event=stripe().webhooks.constructEvent(await raw(req),req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);}
 catch(e){return respond(res,400,{error:'Invalid signature'});}
 try{
  const store=db(),o=event.data.object;
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)&&o.payment_status==='paid'){
   const {error}=await store.from('payments').update({status:'paid',payment_intent_id:o.payment_intent}).eq('checkout_session_id',o.id).eq('status','pending');
   if(error)throw error;
  }
  if(event.type==='checkout.session.async_payment_failed')await store.from('payments').update({status:'failed'}).eq('checkout_session_id',o.id).eq('status','pending');
  if(event.type==='charge.dispute.created')await store.from('payments').update({status:'disputed'}).eq('payment_intent_id',o.payment_intent);
  if(event.type==='charge.refunded')await store.from('payments').update({status:'refunded'}).eq('payment_intent_id',o.payment_intent);
  return respond(res,200,{received:true});
 }catch(e){console.error('Stripe webhook processing failed:',e.message);return respond(res,500,{error:'Webhook processing failed'});}
}