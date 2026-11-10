import {createClient} from '@supabase/supabase-js';
import Stripe from 'stripe';
export const respond=(res,status,data)=>res.status(status).json(data);
export const origin=()=>process.env.SITE_URL||'https://joinlaunchory.com';
export const db=()=>{if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Database server is not configured');return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})};
export const stripe=()=>{if(!process.env.STRIPE_SECRET_KEY)throw new Error('Stripe payments are not configured');return new Stripe(process.env.STRIPE_SECRET_KEY)};
export async function authorized(req){const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!token)return null;const {data,error}=await db().auth.getUser(token);return error?null:data.user;}
export function safeError(e){console.error('Launchory API failure:',e?.message);return e?.message?.includes('not configured')?503:500;}
