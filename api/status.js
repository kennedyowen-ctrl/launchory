export default function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 res.setHeader('Cache-Control','no-store');
 const paymentsConfigured=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_WEBHOOK_SECRET);
 return res.status(200).json({paymentsConfigured});
}
