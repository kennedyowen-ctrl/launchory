import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.4';
const cfg=window.LAUNCHORY_CONFIG||{},db=cfg.supabaseUrl&&cfg.supabaseAnonKey?createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let user=null,profile=null,projects=[],proposals=[],creatives=[];
const note=msg=>{const n=$('notice');n.textContent=msg;n.style.display='block';window.scrollTo({top:0,behavior:'smooth'});};
const run=async p=>{const {data,error}=await p;if(error)throw error;return data;};
async function call(path,body){const token=(await db.auth.getSession()).data.session?.access_token;const r=await fetch('/api/'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body||{})});const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed');return j;}
function tab(name){for(const s of document.querySelectorAll('[id^="tab-"]'))s.classList.add('hidden');$('tab-'+name)?.classList.remove('hidden');for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===name);location.hash=name;}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>tab(b.dataset.tab);
async function refresh(){if(!db)return;try{user=(await db.auth.getUser()).data.user;$('auth-panel').style.display=user?'none':'block';$('app').style.display=user?'block':'none';$('signout').style.display=user?'inline':'none';if(!user)return;profile=await run(db.from('profiles').select('*').eq('id',user.id).maybeSingle());if(!profile){note('Your account profile is being prepared. Please try signing out and back in.');return;}$('greeting').textContent='Welcome, '+(profile.full_name.split(' ')[0]||'founder')+'.';await load();const h=location.hash.slice(1);if(['explore','creatives','projects','inbox','profile','payments'].includes(h))tab(h);}catch(e){note(e.message);}}
if(!db){$('setup').classList.remove('hidden');$('auth-panel').style.display='none';}
else {db.auth.onAuthStateChange(()=>setTimeout(refresh,0));await refresh();}
$('signup').onclick=async()=>{try{const full_name=$('fullname').value.trim(),role=$('role').value,email=$('email').value.trim(),password=$('password').value;if(full_name.length<2||password.length<8)throw Error('Enter your name and a password of 8+ characters.');const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name,role}}});if(error)throw error;if(data.session)await refresh();else note('Please confirm your email, then sign in.');}catch(e){note(e.message);}};
$('login').onclick=async()=>{try{await run(db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}));await refresh();}catch(e){note(e.message);}};
$('signout').onclick=async e=>{e.preventDefault();await db.auth.signOut();await refresh();};
async function load(){projects=await run(db.from('projects').select('*,profiles!projects_founder_id_fkey(full_name)').order('created_at',{ascending:false}).limit(100));creatives=await run(db.from('profiles').select('id,full_name,headline,specialty,bio,portfolio_url,location,skills,availability,starting_rate_cents').eq('role','creative').order('created_at',{ascending:false}).limit(100));drawProjects();drawCreatives();drawOwn();await drawInbox();await drawInvitations();drawProfile();await drawPayments();drawStats();}

function drawProjects(){
 const open=projects.filter(p=>p.status==='open');
 $('project-feed').innerHTML=open.map(p=>`<article class="card project-card">
 <div class="project-head"><span class="tag">${esc(p.category)}</span><span class="budget">$${(p.budget_cents/100).toLocaleString()}</span></div>
 <div><div class="small-label">Project opportunity</div><h3>${esc(p.title)}</h3><p class="muted mini">Posted by ${esc(p.profiles?.full_name||'A founder')} · ${new Date(p.created_at).toLocaleDateString()}</p></div>
 <p class="muted">${esc(p.description.length>170?p.description.slice(0,170)+'…':p.description)}</p>
 <div class="project-actions"><span class="mini muted">Open for proposals</span><button class="secondary" data-project-detail="${p.id}">View project →</button></div></article>`).join('')||emptyMarkup('No open projects yet','Founders are preparing new opportunities. Check back for fresh briefs.');
 for(const b of document.querySelectorAll('[data-project-detail]'))b.onclick=()=>showProject(b.dataset.projectDetail);
}


function drawCreatives(){
 const q=($('creative-search')?.value||'').trim().toLowerCase(),cat=$('creative-category')?.value||'';
 const people=creatives.filter(p=>(!cat||p.specialty===cat)&&(!q||[p.full_name,p.headline,p.specialty,p.bio,p.location,...(p.skills||[])].join(' ').toLowerCase().includes(q)));
 $('creative-feed').classList.add('profile-grid');
 $('creative-feed').innerHTML=people.map(p=>`<article class="card talent-card"><div class="talent-top"><div class="talent-avatar" aria-hidden="true">${esc(initials(p.full_name))}</div><div><div class="talent-name">${esc(p.full_name||'Creative member')}</div><p class="mini">${esc(p.location||'Remote / flexible')}</p></div></div>
 <div><span class="small-label">${esc(p.specialty||'Creative services')}</span><h3>${esc(p.headline||'Explore my creative work and services')}</h3></div>
 <p class="bio">${esc((p.bio||'Profile details coming soon.').slice(0,170))}${(p.bio||'').length>170?'…':''}</p>
 <div class="meta">${(p.skills||[]).slice(0,3).map(skill=>`<span class="tag">${esc(skill)}</span>`).join('')||`<span class="tag">${esc(p.availability||'Open to projects')}</span>`}</div>
 <div class="talent-bottom"><div class="mini muted">${p.starting_rate_cents!=null?'From $'+(p.starting_rate_cents/100).toLocaleString():esc(p.availability||'Open to projects')}</div><button class="secondary" data-profile-detail="${p.id}">View profile →</button></div></article>`).join('')||emptyMarkup('Your next collaborator is on the way','Try another specialty, or check back as creatives finish their profiles.');
 for(const b of document.querySelectorAll('[data-profile-detail]'))b.onclick=()=>showCreative(b.dataset.profileDetail);
}

$('creative-search').oninput=drawCreatives;$('creative-category').onchange=drawCreatives;

function drawOwn(){
 const founder=profile.role==='founder',my=projects.filter(p=>p.founder_id===user.id);
 $('post-panel').classList.toggle('hidden',!founder);
 $('my-project-feed').innerHTML=founder?my.map(p=>`<article class="card"><span class="tag">${esc(p.status)}</span><h3>${esc(p.title)}</h3><p class="muted mini">${esc(p.category)} · $${(p.budget_cents/100).toLocaleString()}</p><p class="muted">${esc((p.description||'').slice(0,155))}</p><button class="secondary small-cta" data-project-detail="${p.id}">View details</button></article>`).join('')||emptyMarkup('Start with your first project','Tell creatives what you are creating, and start getting proposals.'):
 '<div class="card"><h3>Discover creative opportunities</h3><p class="muted">Your proposals and conversations live in Connections. Find your next project from the opportunities board.</p><button id="see-open-projects">Explore open projects</button></div>';
 document.querySelectorAll('[data-project-detail]').forEach(b=>b.onclick=()=>showProject(b.dataset.projectDetail));
 if(!founder)$('see-open-projects').onclick=()=>tab('explore');
}

$('project-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),amount=Math.round(Number(f.get('budget'))*100);try{if(!Number.isSafeInteger(amount)||amount<100)throw Error('Enter a valid budget.');await run(db.from('projects').insert({founder_id:user.id,title:String(f.get('title')).trim(),category:f.get('category'),description:String(f.get('description')).trim(),budget_cents:amount}));e.target.reset();await load();tab('projects');note('Project posted.');}catch(ex){note(ex.message);}};
async function propose(id){const amount=prompt('Enter your project quote in USD:'),message=prompt('Describe your approach, deliverables, and proposed timeline:');if(amount===null||message===null)return;try{const cents=Math.round(Number(amount)*100);if(!Number.isSafeInteger(cents)||cents<100||message.trim().length<10)throw Error('Enter a valid quote and at least 10 characters describing your offer.');await run(db.from('proposals').insert({project_id:id,creative_id:user.id,amount_cents:cents,message:message.trim()}));note('Your proposal has been sent.');await load();tab('inbox');}catch(e){note(e.message);}}
async function drawInbox(){proposals=await run(db.from('proposals').select('*,projects!inner(title,founder_id),profiles!proposals_creative_id_fkey(full_name)').order('created_at',{ascending:false}));$('proposal-feed').innerHTML=proposals.map(p=>{const founder=p.projects.founder_id===user.id;return `<div class="card"><h3>${esc(p.projects.title)}</h3><p class="muted mini">${esc(p.profiles?.full_name||'Creative')} · $${(p.amount_cents/100).toFixed(2)} · ${esc(p.status)}</p><p>${esc(p.message)}</p>${founder&&p.status==='pending'?'<button data-accept="'+p.id+'">Accept proposal</button>':''}${founder&&p.status==='accepted'?'<button data-pay="'+p.id+'">Pay securely</button> <button class="secondary" data-release="'+p.id+'">Approve delivery & release payment</button>':''}<div id="thread-${p.id}"></div><form data-message="${p.id}"><input name="body" required maxlength="4000" placeholder="Send a private message"><button class="secondary">Send</button></form></div>`;}).join('')||'<p class="muted">No conversations yet.</p>';
for(const p of proposals){const ms=await run(db.from('messages').select('sender_id,body,created_at').eq('proposal_id',p.id).order('created_at',{ascending:true}).limit(100));$('thread-'+p.id).innerHTML=ms.map(m=>`<div class="message ${m.sender_id===user.id?'mine':''}">${esc(m.body)}</div>`).join('');}
for(const b of document.querySelectorAll('[data-accept]'))b.onclick=async()=>{try{await run(db.from('proposals').update({status:'accepted'}).eq('id',b.dataset.accept).eq('status','pending'));await load();}catch(e){note(e.message);}};
for(const b of document.querySelectorAll('[data-pay]'))b.onclick=async()=>{try{const r=await call('checkout',{proposal_id:b.dataset.pay});location.href=r.url;}catch(e){note(e.message);}};
for(const b of document.querySelectorAll('[data-release]'))b.onclick=async()=>{if(!confirm('I confirm the agreed work was delivered. Approve transferring the creative share?'))return;try{await call('release',{proposal_id:b.dataset.release});note('Delivery approved. Transfer processing.');await load();}catch(e){note(e.message);}};
for(const f of document.querySelectorAll('[data-message]'))f.onsubmit=async e=>{e.preventDefault();try{await run(db.from('messages').insert({proposal_id:f.dataset.message,sender_id:user.id,body:f.elements.body.value.trim()}));await drawInbox();}catch(e){note(e.message);}};
}

function drawProfile(){
 const f=$('profile-form');
 for(const k of ['full_name','headline','specialty','location','portfolio_url','bio','availability'])if(f.elements[k])f.elements[k].value=profile[k]||'';
 f.elements.skills.value=(profile.skills||[]).join(', ');
 f.elements.starting_rate.value=profile.starting_rate_cents==null?'':profile.starting_rate_cents/100;
 renderProfilePreview();
}

$('profile-form').onsubmit=async e=>{e.preventDefault();try{const v={},f=e.target;for(const k of ['full_name','headline','specialty','location','portfolio_url','bio','availability'])v[k]=f.elements[k].value.trim();v.skills=f.elements.skills.value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,12);const rate=f.elements.starting_rate.value;v.starting_rate_cents=rate===''?null:Math.round(Number(rate)*100);if(v.starting_rate_cents!=null&&(!Number.isSafeInteger(v.starting_rate_cents)||v.starting_rate_cents<0))throw Error('Enter a valid starting rate.');await run(db.from('profiles').update(v).eq('id',user.id));note('Your profile is saved.');await refresh();}catch(e){note(e.message);}};
$('connect').onclick=async()=>{try{const r=await call('connect',{});location.href=r.url;}catch(e){note(e.message);}};
async function drawPayments(){$('connect').style.display=profile.role==='creative'?'inline-block':'none';const a=await run(db.from('payments').select('amount_cents,fee_cents,status,created_at').order('created_at',{ascending:false}));$('payment-feed').innerHTML=a.map(p=>`<div class="card">$${(p.amount_cents/100).toFixed(2)} · ${esc(p.status)} · Launchory fee $${(p.fee_cents/100).toFixed(2)}</div>`).join('')||'<p class="muted">No payments yet.</p>';}

function emptyMarkup(title,description){return `<div class="empty"><strong>${esc(title)}</strong><p>${esc(description)}</p></div>`;}
function initials(name){return String(name||'L').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();}
function money(v){return '$'+(Number(v||0)/100).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2});}
const dialog=$('detail-dialog');
function closeDialog(){dialog.classList.add('hidden');$('dialog-content').innerHTML='';document.body.style.overflow='';}
$('dialog-close').onclick=closeDialog;
dialog.onclick=e=>{if(e.target===dialog)closeDialog();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.classList.contains('hidden'))closeDialog();});
function openDialog(html){$('dialog-content').innerHTML=html;dialog.classList.remove('hidden');document.body.style.overflow='hidden';$('dialog-close').focus();}
function showCreative(id){
 const p=creatives.find(x=>x.id===id);if(!p)return;
 const my=projects.filter(x=>x.founder_id===user?.id&&x.status==='open');
 const canInvite=profile?.role==='founder'&&my.length>0;
 openDialog(`<div class="eyebrow">CREATIVE PROFILE</div><div class="talent-top"><div class="talent-avatar">${esc(initials(p.full_name))}</div><div><div class="talent-name">${esc(p.full_name)}</div><div class="muted mini">${esc(p.location||'Remote / flexible')}</div></div></div>
 <h2 style="margin-top:22px">${esc(p.headline||p.specialty||'Creative professional')}</h2>
 <div class="modal-meta"><span class="tag">${esc(p.specialty||'Creative')}</span><span class="tag">${esc(p.availability||'Open to projects')}</span>${p.starting_rate_cents!=null?`<span class="tag">Starting at ${money(p.starting_rate_cents)}</span>`:''}</div>
 <hr class="section-rule"><div class="small-label">ABOUT</div><p class="modal-bio">${esc(p.bio||'This creative has not added an introduction yet.')}</p>
 <div class="small-label">SERVICES & SKILLS</div><div class="meta">${(p.skills||[]).length?(p.skills||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join(''):'<span class="muted mini">Not specified yet</span>'}</div>
 <div class="modal-cta">${safeLink(p.portfolio_url)?`<a class="button" href="${esc(p.portfolio_url)}" target="_blank" rel="noopener noreferrer">View portfolio ↗</a>`:''}
 ${profile?.role==='founder'?'<button id="invite-open">Invite to a project</button>':''}</div>
 ${profile?.role==='founder'&&!canInvite?'<p class="muted mini">Post a project first to invite this creative, so they can review the scope and send you a proposal.</p>':''}
 <div id="invite-form-area"></div>`);
 const btn=$('invite-open');if(btn)btn.onclick=()=>{
  if(!canInvite){closeDialog();tab('projects');$('post-panel')?.scrollIntoView({behavior:'smooth'});return;}
  $('invite-form-area').innerHTML=`<hr class="section-rule"><h3>Invite ${esc(p.full_name)} to collaborate</h3><p class="muted mini">Select an open project and send a short introduction.</p><form id="invite-form"><label>Choose a project<select name="project_id">${my.map(v=>`<option value="${v.id}">${esc(v.title)}</option>`).join('')}</select></label><label>Personal message<textarea name="message" maxlength="1000" placeholder="I think your work could be a great fit for this project. I'd love to see your approach."></textarea></label><button>Send project invitation</button></form>`;
  $('invite-form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);try{await run(db.from('project_invitations').insert({project_id:String(fd.get('project_id')),founder_id:user.id,creative_id:id,message:String(fd.get('message')||'').trim()}));closeDialog();note('Invitation sent! The creative can view it in Connections.');await drawInvitations();}catch(error){note(error.message);}};
 };
}
function safeLink(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol);}catch{return false;}}
function showProject(id){
 const p=projects.find(x=>x.id===id);if(!p)return;
 openDialog(`<div class="eyebrow">PROJECT BRIEF</div><h2>${esc(p.title)}</h2><div class="modal-meta"><span class="tag">${esc(p.category)}</span><span class="tag">${esc(p.status)}</span><span class="tag">Budget ${money(p.budget_cents)}</span></div><p class="mini muted">Posted by ${esc(p.profiles?.full_name||'A founder')} · ${new Date(p.created_at).toLocaleDateString()}</p><hr class="section-rule"><div class="small-label">SCOPE & DELIVERABLES</div><p class="modal-bio">${esc(p.description)}</p>${profile?.role==='creative'&&p.status==='open'?`<div class="modal-cta"><button id="start-proposal">Send a proposal</button></div><div id="proposal-area"></div>`:'<p class="muted mini">Founders can manage proposals and conversations in Connections.</p>'}`);
 if($('start-proposal'))$('start-proposal').onclick=()=>showProposalForm(id);
}
function showProposalForm(id){
 const p=projects.find(x=>x.id===id);if(!p)return;
 const area=$('proposal-area');area.innerHTML=`<hr class="section-rule"><h3>Make your introduction</h3><p class="muted mini">Share an accurate quote, your approach, timeline, and deliverables. Founders review this before hiring.</p><form id="proposal-create-form"><label>Your total quote (USD)<input type="number" name="amount" min="1" step="1" value="${Math.round(p.budget_cents/100)}" required></label><label>What will you deliver?<textarea name="message" required minlength="10" maxlength="4000" placeholder="I'd love to help with this project. Here's my proposed scope, estimated timeline, and what is included."></textarea></label><button>Send proposal</button></form>`;
 $('proposal-create-form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),cents=Math.round(Number(fd.get('amount'))*100),message=String(fd.get('message')||'').trim();try{if(!Number.isSafeInteger(cents)||cents<100||message.length<10)throw Error('Enter a valid quote and proposal.');await run(db.from('proposals').insert({project_id:id,creative_id:user.id,amount_cents:cents,message}));closeDialog();note('Proposal sent. You can message the founder from Connections.');await load();tab('inbox');}catch(error){note(error.message);}};
}
async function drawInvitations(){
 const invites=await run(db.from('project_invitations').select('id,project_id,founder_id,creative_id,message,created_at').order('created_at',{ascending:false}).limit(100));
 $('invite-feed').innerHTML=invites.length?'<div class="eyebrow">PROJECT INVITATIONS</div>'+invites.map(i=>{const p=projects.find(x=>x.id===i.project_id),sent=i.founder_id===user.id;return `<article class="card"><div class="small-label">${sent?'INVITATION SENT':'YOU HAVE BEEN INVITED'}</div><h3>${esc(p?.title||'Project invitation')}</h3><p class="muted">${esc(i.message||'Explore the project and reach out if it feels like a fit.')}</p>${!sent?`<button class="secondary" data-invite-project="${i.project_id}">View project & respond →</button>`:'<span class="mini muted">The creative can respond with a proposal.</span>'}</article>`;}).join(''):'';
 document.querySelectorAll('[data-invite-project]').forEach(b=>b.onclick=()=>showProject(b.dataset.inviteProject));
}
function drawStats(){
 const mine=projects.filter(x=>x.founder_id===user.id),ownProposals=proposals.filter(x=>x.creative_id===user.id);
 const a=profile.role==='founder'?[['Projects posted',mine.length],['Open opportunities',mine.filter(x=>x.status==='open').length],['Proposals received',proposals.filter(x=>mine.some(p=>p.id===x.project_id)).length]]:[['Open projects',projects.filter(x=>x.status==='open').length],['Your proposals',ownProposals.length],['Active conversations',ownProposals.filter(x=>x.status==='accepted').length]];
 $('quick-stats').innerHTML=a.map(([label,value])=>`<div class="stat"><b>${value}</b><span>${esc(label)}</span></div>`).join('');
 $('primary-action').textContent=profile.role==='founder'?'Post a project':'Find projects';
 $('secondary-action').textContent=profile.role==='founder'?'Explore creatives':'Edit my profile';
 $('primary-action').onclick=()=>{tab(profile.role==='founder'?'projects':'explore');if(profile.role==='founder')$('post-panel').scrollIntoView({behavior:'smooth'});};
 $('secondary-action').onclick=()=>tab(profile.role==='founder'?'creatives':'profile');
 $('hero-action').onclick=()=>tab(profile.role==='founder'?'creatives':'explore');
}
function renderProfilePreview(){
 if(!profile)return;
 const f=$('profile-form'),full_name=f.elements.full_name.value||profile.full_name,headline=f.elements.headline.value||profile.headline,specialty=f.elements.specialty.value,location=f.elements.location.value;
 $('profile-preview-content').innerHTML=`<div class="talent-avatar">${esc(initials(full_name))}</div><h3>${esc(full_name)}</h3><p>${esc(headline||'Your headline will appear here')}</p><div class="meta"><span class="tag">${esc(specialty||'Choose specialty')}</span><span class="tag">${esc(location||'Remote')}</span></div>`;
}
for(const el of $('profile-form').querySelectorAll('input,select,textarea'))el.addEventListener('input',renderProfilePreview);
$('nav-explore').onclick=e=>{if(user){e.preventDefault();tab('explore');}};
$('nav-creatives').onclick=e=>{if(user){e.preventDefault();tab('creatives');}};
$('nav-dashboard').onclick=e=>{if(user){e.preventDefault();tab('projects');}};
