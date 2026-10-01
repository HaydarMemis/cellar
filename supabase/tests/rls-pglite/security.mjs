import { setup, as, admin } from './harness.mjs';
const db = await setup();
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
await admin(db, `insert into auth.users values ('${A}','a@x'),('${B}','b@x');
 insert into public.profiles (id,username,display_name,avatar_color_seed) values ('${A}','alice','A','a'),('${B}','bob','B','b');`);
let pass=0, fail=0; const check=(name,cond,detail)=>{cond?pass++:fail++; console.log((cond?'PASS':'FAIL')+'  '+name+(cond?'':'  '+JSON.stringify(detail)));};
const R='33333333-3333-4333-8333-333333333333';
const ins=(uid,id,owner)=>as(db,'authenticated',uid,`insert into public.recipes (id,owner_id,name,base_spirit,method,difficulty,prep_time_minutes,ingredients,steps) values ($1,$2,'X','gin','shake','easy',5,'[{"ingredientId":"gin","amount":{"value":50,"unit":"ml"},"isOptional":false,"isGarnish":false}]','{s}')`,[id,owner]);
let r=await ins(A,R,A); check('A publishes own recipe (uuid id)', r.ok, r);
r=await ins(B,'44444444-4444-4444-8444-444444444444',A); check('B cannot publish as A (forged owner)', !r.ok && r.code==='42501', r);
r=await as(db,'authenticated',B,`update public.recipes set name='hacked' where id=$1`,[R]); check('B cannot update A recipe (0 rows)', r.ok && r.affected===0, r);
r=await as(db,'authenticated',B,`delete from public.recipes where id=$1`,[R]); check('B cannot delete A recipe (0 rows)', r.ok && r.affected===0, r);
r=await as(db,'authenticated',B,`insert into public.recipes (id,owner_id,name,base_spirit,method,difficulty,prep_time_minutes,ingredients,steps) values ($1,$2,'X','gin','shake','easy',5,'[{"ingredientId":"gin","amount":{"value":50,"unit":"ml"},"isOptional":false,"isGarnish":false}]','{s}') on conflict (id) do update set name='hijack'`,[R,B]); check('B cannot hijack A recipe via upsert', !r.ok, r);
r=await as(db,'anon',null,`select count(*)::int c from public.recipes`); check('anon can read published recipes', r.ok && r.rows[0].c===1, r);
r=await as(db,'authenticated',B,`insert into public.likes (user_id,recipe_id) values ($1,$2)`,[B,R]); check('B likes A recipe', r.ok, r);
r=await as(db,'authenticated',B,`insert into public.likes (user_id,recipe_id) values ($1,$2)`,[B,R]); check('duplicate like rejected', !r.ok && r.code==='23505', r);
r=await as(db,'authenticated',B,`insert into public.likes (user_id,recipe_id) values ($1,$2)`,[A,R]); check('forged like identity rejected', !r.ok && r.code==='42501', r);
r=await as(db,'authenticated',A,`insert into public.follows (follower_id,following_id) values ($1,$1)`,[A]); check('self-follow rejected', !r.ok, r);
r=await as(db,'authenticated',A,`insert into public.blocks (blocker_id,blocked_id) values ($1,$2)`,[A,B]); check('A blocks B', r.ok, r);
await admin(db,`delete from public.likes`);
r=await as(db,'authenticated',B,`insert into public.likes (user_id,recipe_id) values ($1,$2)`,[B,R]); check('blocked B cannot like A recipe (SECURITY DEFINER helper sees block)', !r.ok && r.code==='42501', r);
r=await as(db,'authenticated',B,`insert into public.follows (follower_id,following_id) values ($1,$2)`,[B,A]); check('blocked B cannot follow A', !r.ok && r.code==='42501', r);
r=await as(db,'authenticated',B,`select count(*)::int c from public.blocks`); check('B cannot read A block list', r.ok && r.rows[0].c===0, r);
r=await as(db,'authenticated',A,`insert into public.subscribers (user_id,is_premium) values ($1,true)`,[A]); check('premium self-grant rejected', !r.ok, r);
r=await as(db,'authenticated',A,`insert into public.reports (reporter_id,target_type,target_id,reason) values ($1,'user',$2,'spam')`,[A,B]); check('report filed', r.ok, r);
r=await as(db,'authenticated',A,`insert into public.reports (reporter_id,target_type,target_id,reason) values ($1,'user',$2,'spam')`,[A,B]); check('duplicate open report rejected', !r.ok && r.code==='23505', r);
r=await as(db,'authenticated',B,`select count(*)::int c from public.reports`); check('B cannot read A reports', r.ok && r.rows[0].c===0, r);
r=await as(db,'authenticated',A,`insert into storage.objects (bucket_id,name) values ('recipe-media',$1)`,[`${A}/${R}/photo`]); check('A uploads under own prefix', r.ok, r);
r=await as(db,'authenticated',B,`insert into storage.objects (bucket_id,name) values ('recipe-media',$1)`,[`${A}/${R}/photo2`]); check('B cannot upload under A prefix', !r.ok, r);
r=await as(db,'authenticated',B,`delete from storage.objects where name=$1`,[`${A}/${R}/photo`]); check('B cannot delete A media (0 rows)', r.ok && r.affected===0, r);
// first-sign-in profile creation semantics used by the new client code
const C='55555555-5555-4555-8555-555555555555'; await admin(db,`insert into auth.users values ('${C}','c@x')`);
r=await as(db,'anon',null,`insert into public.profiles (id,username,display_name,avatar_color_seed) values ($1,'carol','C','c')`,[C]); check('anon (pending confirmation) cannot create profile', !r.ok && r.code==='42501', r);
r=await as(db,'authenticated',C,`insert into public.profiles (id,username,display_name,avatar_color_seed) values ($1,'alice','C','c') on conflict (id) do nothing`,[C]); check('first sign-in: taken username -> 23505 (client retries with suffix)', !r.ok && r.code==='23505', r);
r=await as(db,'authenticated',C,`insert into public.profiles (id,username,display_name,avatar_color_seed) values ($1,'carol','C','c') on conflict (id) do nothing returning id`,[C]); check('first sign-in: profile created', r.ok && r.rows.length===1, r);
r=await as(db,'authenticated',C,`insert into public.profiles (id,username,display_name,avatar_color_seed) values ($1,'carol2','OVERWRITE','c') on conflict (id) do nothing returning id`,[C]); check('repeat first-sign-in never overwrites an existing profile', r.ok && r.rows.length===0, r);
await admin(db,`delete from auth.users where id='${B}'`);
r=await as(db,'authenticated',A,`select count(*)::int c from public.reports where reporter_id=$1`,[A]); check('reports survive reported-user deletion', r.ok && r.rows[0].c===1, r);
await admin(db,`delete from auth.users where id='${A}'`);
r=await admin(db,`select count(*)::int c from public.reports where reporter_id is null`); 
const rr = await db.query(`select count(*)::int c from public.reports where reporter_id is null`); check('reporter deletion -> reporter_id SET NULL', rr.rows[0].c===1, rr.rows);
const rc = await db.query(`select count(*)::int c from public.recipes`); check('owner deletion cascades recipes', rc.rows[0].c===0, rc.rows);
// --- production hardening migration (20260926120000) ---
const D='66666666-6666-4666-8666-666666666666';
await admin(db,`insert into auth.users values ('${D}','d@x'); insert into public.profiles (id,username,display_name,avatar_color_seed) values ('${D}','dave','D','d')`);
const R2='77777777-7777-4777-8777-777777777777';
r=await as(db,'authenticated',D,`insert into public.recipes (id,owner_id,name,base_spirit,method,difficulty,prep_time_minutes,ingredients,steps,created_at) values ($1,$2,'X','gin','shake','easy',5,'[{"ingredientId":"gin","amount":{"value":50,"unit":"ml"},"isOptional":false,"isGarnish":false}]','{s}','2099-01-01') returning created_at`,[R2,D]);
check('client-supplied future created_at is ignored', r.ok && new Date(r.rows[0].created_at).getFullYear() < 2099, r);
r=await as(db,'authenticated',D,`insert into public.recipes (id,owner_id,name,base_spirit,method,difficulty,prep_time_minutes,ingredients,steps) values ($1,$2,'Y','gin','shake','easy',5,'[{"ingredientId":"gin","amount":{"value":50,"unit":"ml"},"isOptional":false,"isGarnish":false}]','{s}') on conflict (id) do update set name=excluded.name, created_at='2099-01-01' returning created_at, name`,[R2,D]);
check('upsert keeps original created_at', r.ok && r.rows[0].name==='Y' && new Date(r.rows[0].created_at).getFullYear() < 2099, r);
const C2='55555555-5555-4555-8555-555555555555';
r=await as(db,'authenticated',D,`update public.recipes set owner_id=$1 where id=$2 returning owner_id`,[C2,R2]);
check('owner_id cannot be changed by its owner', (!r.ok) || (r.rows[0]?.owner_id===D), r);
r=await as(db,'authenticated',D,`update public.recipes set photo_url='file:///var/x.jpg' where id=$1`,[R2]);
check('non-https photo_url rejected', !r.ok && r.code==='23514', r);
r=await as(db,'authenticated',D,`update public.profiles set bio=repeat('x',301) where id=$1`,[D]);
check('over-long bio rejected', !r.ok && r.code==='23514', r);
r=await as(db,'authenticated',D,`insert into public.reports (reporter_id,target_type,target_id,reason) values ($1,'recipe',$2,'made-up')`,[D,R2]);
check('unknown report reason rejected', !r.ok && r.code==='23514', r);
await as(db,'authenticated',C2,`insert into public.likes (user_id,recipe_id) values ($1,$2)`,[C2,R2]);
r=await as(db,'anon',null,`select * from public.recipe_like_counts($1)`,[[R2]]);
check('recipe_like_counts aggregates for anon', r.ok && r.rows.length===1 && Number(r.rows[0].like_count)===1, r);
r=await as(db,'authenticated',D,`insert into public.subscribers (user_id,is_premium,last_event_at) values ($1,true,now())`,[D]);
check('premium self-grant still rejected after hardening', !r.ok, r);

// --- audit hardening migration (20260927120000) ---
{
const E='88888888-8888-4888-8888-888888888888', F='99999999-9999-4999-8999-999999999999', H='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', I='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
await admin(db,`insert into auth.users values ('${E}','e@x'),('${F}','f@x'),('${H}','h@x'),('${I}','i@x');
 insert into public.profiles (id,username,display_name,avatar_color_seed,created_at) values ('${E}','erin','E','e','2999-01-01'),('${F}','frank','F','f','2999-01-01'),('${H}','hana','H','h',now()),('${I}','ivan','I','i',now());`);
const rid=()=>crypto.randomUUID();
const year=(v)=>new Date(v).getFullYear();
// Exactly what app/recipe-editor.tsx -> RemoteRecipeBackend.publishRecipe sends (JSON of RecipeIngredient[]; `note` omitted when empty).
const EDITOR_ING=JSON.stringify([
  { ingredientId:'gin', amount:{ value:1.5, unit:'oz' }, isOptional:false, isGarnish:false },
  { ingredientId:'lime-juice', amount:null, note:'freshly squeezed', isOptional:true, isGarnish:false },
]);
const base={name:"'X'",base_spirit:"'gin'",method:"'shake'",difficulty:"'easy'",prep_time_minutes:'5',ingredients:`'${EDITOR_ING}'`,steps:"'{s}'",glass:"'{coupe}'"};
const insR=(uid,id,over={})=>{const o={...base,...over};return as(db,'authenticated',uid,`insert into public.recipes (id,owner_id,${Object.keys(o)}) values ($1,$2,${Object.values(o)}) returning *`,[id,uid]);};
const rejects=(r)=>!r.ok&&r.code==='23514';

// 1. content validation
const RE=rid(); r=await insR(E,RE); check('editor-shaped recipe accepted', r.ok, r);
r=await insR(E,rid(),{steps:`array(select repeat('s',500) from generate_series(1,30))`,category:"'{classic,old-fashioned}'",tags:"'{sweet,refreshing}'",glass:"'{nick-and-nora}'",ingredients:`(select jsonb_agg(jsonb_build_object('ingredientId','gin','amount',jsonb_build_object('value',g,'unit','ml'),'isOptional',false,'isGarnish',false)) from generate_series(1,40) g)`});
check('recipe at the editor maximums (30x500-char steps, 40 ingredients) accepted', r.ok, r);
for (const m of ['stir','build','blend','muddle','layer']) { r=await insR(E,rid(),{method:`'${m}'`}); if(!r.ok) break; }
check('every PreparationMethod accepted', r.ok, r);
r=await insR(E,rid(),{glass:`array['rocks','copper-mug','julep-cup','irish-coffee-glass','tiki-mug','other']`}); check('GlassType values accepted', r.ok, r);
r=await insR(E,rid(),{steps:"'{}'"}); check('empty steps {} rejected (array_length NULL bypass closed)', rejects(r), r);
r=await insR(E,rid(),{steps:`array(select 's' from generate_series(1,31))`}); check('31 steps rejected', !r.ok&&r.code==='23514', r);
r=await insR(E,rid(),{steps:"array[repeat('s',1001)]"}); check('1001-char step rejected', rejects(r), r);
r=await insR(E,rid(),{steps:"'{{a,b},{c,d}}'"}); check('2-D steps rejected', rejects(r), r);
r=await insR(E,rid(),{steps:"array['a',null]"}); check('null step rejected', rejects(r), r);
r=await insR(E,rid(),{method:"repeat('m',100000)"}); check('unknown/huge method rejected', rejects(r), r);
r=await insR(E,rid(),{glass:"'{<script>}'"}); check('unknown glass rejected', rejects(r), r);
r=await insR(E,rid(),{tags:"array[repeat('t',65)]"}); check('over-long tag rejected', rejects(r), r);
r=await insR(E,rid(),{category:"array[repeat('c',100000)]"}); check('huge category item rejected', rejects(r), r);
r=await insR(E,rid(),{ingredients:"'[1]'"}); check('scalar ingredient element rejected', rejects(r), r);
r=await insR(E,rid(),{ingredients:`'[{"amount":null}]'`}); check('ingredient without ingredientId rejected', rejects(r), r);
r=await insR(E,rid(),{ingredients:`'[{"ingredientId":7}]'`}); check('non-string ingredientId rejected', rejects(r), r);
r=await insR(E,rid(),{ingredients:`'[{"ingredientId":"gin","amount":{"value":"50","unit":"ml"}}]'`}); check('non-numeric amount.value rejected', rejects(r), r);
r=await insR(E,rid(),{ingredients:`'[{"ingredientId":"gin","amount":{"value":50,"unit":"bucket"}}]'`}); check('unknown unit rejected', rejects(r), r);
r=await insR(E,rid(),{ingredients:`jsonb_build_array(jsonb_build_object('ingredientId','g','note',repeat('n',100000)))`}); check('huge ingredient note rejected', rejects(r), r);
r=await insR(E,rid(),{ingredients:`(select jsonb_agg(jsonb_build_object('ingredientId','gin')) from generate_series(1,41))`}); check('41 ingredients rejected', rejects(r), r);
r=await insR(E,rid(),{ingredients:`'{"ingredientId":"gin"}'`}); check('non-array ingredients rejected', !r.ok, r);

// 2. media URLs must be the owner's own object for this recipe
const HOST='https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/recipe-media';
let RP=rid(); r=await insR(E,RP,{photo_url:`'${HOST}/${E}/${RP}/photo?v=1727000000000'`}); check('own versioned photo_url accepted (mediaUpload.ts shape)', r.ok, r);
RP=rid(); r=await insR(E,RP,{photo_url:`'${HOST}/${E}/${RP}/photo'`,video_url:`'${HOST}/${E}/${RP}/video?v=1'`}); check('own unversioned photo_url + own video_url accepted', r.ok, r);
r=await insR(E,rid(),{photo_url:"'https://attacker.example/pixel.gif'"}); check('external photo_url rejected', rejects(r), r);
RP=rid(); r=await insR(E,RP,{photo_url:`'${HOST}/${F}/${RP}/photo'`}); check("photo_url pointing at another user's media rejected", rejects(r), r);
RP=rid(); r=await insR(E,RP,{photo_url:`'${HOST}/${E}/${RE}/photo'`}); check("photo_url pointing at another recipe's media rejected", rejects(r), r);
RP=rid(); r=await insR(E,RP,{video_url:`'${HOST}/${E}/${RP}/photo'`}); check('video_url pointing at the photo object rejected', rejects(r), r);
RP=rid(); r=await insR(E,RP,{photo_url:`'${HOST}/${E}/${RP}/photo?v=1&x=https://evil'`}); check('photo_url with extra query rejected', rejects(r), r);
RP=rid(); r=await insR(E,RP,{photo_url:`'https://abcdefghijklmnopqrst.supabase.co.evil.example/storage/v1/object/public/recipe-media/${E}/${RP}/photo'`}); check('look-alike host rejected', rejects(r), r);

// 3. recipe id immutable
r=await as(db,'authenticated',E,`update public.recipes set id=$1 where id=$2 returning id`,[rid(),RE]); check('recipe id cannot be changed on update', r.ok && r.rows[0]?.id===RE, r);

// 4. server-owned created_at
r=await db.query(`select created_at from public.profiles where id=$1`,[E]); check('profile created_at forged on insert is ignored', year(r.rows[0].created_at)<2999, r.rows);
const pBefore=r.rows[0].created_at;
r=await as(db,'authenticated',E,`update public.profiles set created_at='2999-01-01', display_name='E2' where id=$1 returning created_at`,[E]); check('profile created_at cannot be changed on update', r.ok && new Date(r.rows[0].created_at).getTime()===new Date(pBefore).getTime(), r);
const RF=rid(); await insR(F,RF);
r=await as(db,'authenticated',E,`insert into public.likes (user_id,recipe_id,created_at) values ($1,$2,'2999-01-01') returning created_at`,[E,RF]); check('like created_at forged is ignored', r.ok && year(r.rows[0].created_at)<2999, r);
r=await as(db,'authenticated',E,`insert into public.follows (follower_id,following_id,created_at) values ($1,$2,'2999-01-01') returning created_at`,[E,F]); check('follow created_at forged is ignored', r.ok && year(r.rows[0].created_at)<2999, r);

// 5. reports
r=await as(db,'authenticated',E,`insert into public.reports (reporter_id,target_type,target_id,reason,status,created_at) values ($1,'user',$2,'spam','dismissed','1970-01-01') returning status, created_at`,[E,F]); check('report status/created_at forced to open/now', r.ok && r.rows[0].status==='open' && year(r.rows[0].created_at)>2000, r);
r=await as(db,'authenticated',E,`insert into public.reports (reporter_id,target_type,target_id,reason,status) values ($1,'user',$2,'spam','reviewed')`,[E,F]); check('dedupe index no longer bypassable via client status', !r.ok&&r.code==='23505', r);
r=await as(db,'authenticated',E,`insert into public.reports (reporter_id,target_type,target_id,reason) values ($1,'recipe',$2,'spam')`,[E,rid()]); check('report against nonexistent recipe rejected (23503)', !r.ok&&r.code==='23503', r);
r=await as(db,'authenticated',E,`insert into public.reports (reporter_id,target_type,target_id,reason) values ($1,'user',$2,'spam')`,[E,rid()]); check('report against nonexistent user rejected (23503)', !r.ok&&r.code==='23503', r);
r=await as(db,'authenticated',E,`insert into public.reports (reporter_id,target_type,target_id,reason) values ($1,'user',$1,'spam')`,[E]); check('self-report rejected (23503)', !r.ok&&r.code==='23503', r);
r=await as(db,'authenticated',E,`insert into public.reports (reporter_id,target_type,target_id,reason) values ($1,'recipe',$2,'spam') returning id`,[E,RF]); check('report against existing recipe accepted', r.ok, r);
const targets=[]; for(let i=0;i<22;i++){const id=rid(); await insR(F,id); targets.push(id);}
let okc=0,last; for(const id of targets){last=await as(db,'authenticated',H,`insert into public.reports (reporter_id,target_type,target_id,reason) values ($1,'recipe',$2,'spam')`,[H,id]); if(last.ok) okc++;}
check('report rate limit: 20 per hour, then 54000', okc===20 && last.code==='54000', {okc,last});
r=await as(db,'authenticated',I,`insert into public.reports (reporter_id,target_type,target_id,reason) select $1,'recipe',t,'spam' from unnest($2::uuid[]) t`,[I,targets]); check('rate limit also applies within one multi-row insert', !r.ok&&r.code==='54000', r);
r=await db.query(`select count(*)::int c from public.reports where reporter_id=$1`,[I]); check('...and the whole multi-row insert is rolled back', r.rows[0].c===0, r.rows);

// 6. a block severs follows and likes in both directions
await as(db,'authenticated',F,`insert into public.follows (follower_id,following_id) values ($1,$2)`,[F,E]);
await as(db,'authenticated',F,`insert into public.likes (user_id,recipe_id) values ($1,$2)`,[F,RE]);
await as(db,'authenticated',D,`insert into public.likes (user_id,recipe_id) values ($1,$2)`,[D,RF]);
await as(db,'authenticated',D,`insert into public.follows (follower_id,following_id) values ($1,$2)`,[D,F]);
const rel=async()=> (await db.query(`select
  (select count(*) from public.follows where (follower_id=$1 and following_id=$2) or (follower_id=$2 and following_id=$1))::int f,
  (select count(*) from public.likes l join public.recipes r on r.id=l.recipe_id where (l.user_id=$1 and r.owner_id=$2) or (l.user_id=$2 and r.owner_id=$1))::int l,
  (select count(*) from public.likes where user_id=$3)::int dl, (select count(*) from public.follows where follower_id=$3)::int df`,[E,F,D])).rows[0];
r=await rel(); check('precondition: E<->F follow and like each other', r.f===2 && r.l===2, r);
r=await as(db,'authenticated',E,`insert into public.blocks (blocker_id,blocked_id,created_at) values ($1,$2,'2999-01-01') returning created_at`,[E,F]); check('block accepted, forged created_at ignored', r.ok && year(r.rows[0].created_at)<2999, r);
r=await rel(); check('block severed follows and likes in both directions', r.f===0 && r.l===0, r);
check("block left third parties' likes/follows alone", r.dl>=1 && r.df===1, r);
r=await as(db,'authenticated',E,`select public.blocks_sever_relationships()`); check('sever trigger function not callable directly', !r.ok, r);

// 7. SECURITY DEFINER helpers
r=await as(db,'anon',null,`select public.is_blocked_with($1)`,[E]); check('anon cannot execute is_blocked_with', !r.ok&&r.code==='42501', r);
r=await as(db,'anon',null,`select public.is_blocked_from_recipe($1)`,[RE]); check('anon cannot execute is_blocked_from_recipe', !r.ok&&r.code==='42501', r);
r=await as(db,'authenticated',F,`select public.is_blocked_with($1) b`,[E]); check('authenticated can still execute is_blocked_with', r.ok && r.rows[0].b===true, r);
r=await db.query(`select p.oid::regprocedure::text fn from pg_proc p where p.pronamespace='public'::regnamespace and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')`);
check('no SECURITY DEFINER function in public is executable by anon', r.rows.length===0, r.rows);

// 8. storage
const SE=rid();
r=await as(db,'authenticated',E,`insert into storage.objects (bucket_id,name) values ('recipe-media',$1)`,[`${E}/${SE}/photo`]); check('storage: exact <uid>/<uuid>/photo accepted', r.ok, r);
r=await as(db,'authenticated',E,`insert into storage.objects (bucket_id,name) values ('recipe-media',$1)`,[`${E}/${SE}/video`]); check('storage: exact <uid>/<uuid>/video accepted', r.ok, r);
for (const bad of [`${E}/x/y/z.mp4`, `${E}/${SE}/photo.jpg`, `${E}/not-a-uuid/photo`, `${E}/${SE}/avatar`, `${E}/photo`]) {
  r=await as(db,'authenticated',E,`insert into storage.objects (bucket_id,name) values ('recipe-media',$1)`,[bad]); check(`storage: bad path rejected (${bad.slice(37)})`, !r.ok&&r.code==='42501', r);
}
r=await as(db,'authenticated',F,`insert into storage.objects (bucket_id,name) values ('recipe-media',$1)`,[`${E}/${rid()}/photo`]); check("storage: upload under another user's prefix rejected", !r.ok, r);
r=await as(db,'authenticated',E,`update storage.objects set name=$1 where name=$2`,[`${E}/${SE}/evil.exe`,`${E}/${SE}/photo`]); check('storage: rename to a bad path rejected', !r.ok&&r.code==='42501', r);
r=await as(db,'authenticated',E,`select count(*)::int c from storage.objects where bucket_id='recipe-media'`); check('storage: owner can list own media', r.ok && r.rows[0].c===2, r);
r=await as(db,'authenticated',F,`select count(*)::int c from storage.objects where name like $1`,[`${E}/%`]); check("storage: other users cannot list someone's media", r.ok && r.rows[0].c===0, r);
r=await as(db,'anon',null,`select count(*)::int c from storage.objects`); check('storage: anon cannot list the bucket', r.ok && r.rows[0].c===0, r);
await admin(db,`delete from auth.users where id='${I}'`);
r=await as(db,'authenticated',I,`insert into storage.objects (bucket_id,name) values ('recipe-media',$1)`,[`${I}/${rid()}/photo`]); check('storage: deleted account with a still-valid JWT cannot upload', !r.ok, r);

// 9. apply_subscriber_state (service_role only, ordered)
const aps=`select public.apply_subscriber_state($1::uuid,$2::boolean,$3::text,'PRODUCTION','INITIAL_PURCHASE',$4::timestamptz) s`;
r=await as(db,'authenticated',E,aps,[E,true,'yearly','2026-09-27T10:00:00Z']); check('apply_subscriber_state not callable by authenticated', !r.ok&&r.code==='42501', r);
r=await as(db,'anon',null,aps,[E,true,'yearly','2026-09-27T10:00:00Z']); check('apply_subscriber_state not callable by anon', !r.ok&&r.code==='42501', r);
r=await as(db,'service_role',null,aps,[E,true,'yearly','2026-09-27T10:00:00Z']); check('service_role applies state', r.ok && r.rows[0].s==='applied', r);
r=await as(db,'service_role',null,aps,[E,false,null,'2026-09-27T09:00:00Z']); check('older event is ignored (stale)', r.ok && r.rows[0].s==='stale', r);
r=await db.query(`select is_premium, active_plan from public.subscribers where user_id=$1`,[E]); check('...and did not overwrite the newer state', r.rows[0]?.is_premium===true && r.rows[0]?.active_plan==='yearly', r.rows);
r=await as(db,'service_role',null,aps,[E,false,null,'2026-09-27T11:00:00Z']); check('newer event applies', r.ok && r.rows[0].s==='applied', r);
r=await db.query(`select is_premium, active_plan from public.subscribers where user_id=$1`,[E]); check('...and updated the row', r.rows[0]?.is_premium===false && r.rows[0]?.active_plan===null, r.rows);
r=await as(db,'service_role',null,aps,[E,true,'monthly','2026-09-27T11:00:00Z']); check('same-timestamp event applies (>=)', r.ok && r.rows[0].s==='applied', r);
r=await as(db,'service_role',null,aps,[rid(),true,'monthly','2026-09-27T11:00:00Z']); check('unknown user -> no_profile, nothing written', r.ok && r.rows[0].s==='no_profile', r);
r=await as(db,'service_role',null,aps,[E,true,'weekly','2026-09-27T12:00:00Z']); check('invalid plan still rejected by table CHECK', !r.ok&&r.code==='23514', r);
r=await as(db,'authenticated',E,`update public.subscribers set is_premium=true where user_id=$1`,[E]); check('client still cannot write its own subscriber row', r.ok && r.affected===0, r);
}

// --- profile avatars migration (20260928120000) ---
{
const J='cccccccc-cccc-4ccc-8ccc-cccccccccccc', K='dddddddd-dddd-4ddd-8ddd-dddddddddddd', L='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
await admin(db,`insert into auth.users values ('${J}','j@x'),('${K}','k@x'),('${L}','l@x');
 insert into public.profiles (id,username,display_name,avatar_color_seed) values ('${J}','jane','J','j'),('${K}','ken','K','k'),('${L}','lena','L','l');`);
const up=(uid,name,role='authenticated')=>as(db,role,uid,`insert into storage.objects (bucket_id,name) values ('avatars',$1)`,[name]);
const denied=(r)=>!r.ok&&r.code==='42501';
r=await db.query(`select public, file_size_limit::int l, allowed_mime_types m from storage.buckets where id='avatars'`);
check('avatars bucket: public, 5 MB, jpeg/png/webp only', r.rows[0]?.public===true && r.rows[0].l===5242880 && r.rows[0].m.join()==='image/jpeg,image/png,image/webp', r.rows);
r=await up(J,`${J}/avatar`); check('avatars: own <uid>/avatar upload accepted', r.ok, r);
r=await up(K,`${J}/avatar`); check("avatars: upload to another user's path rejected", denied(r), r);
for (const bad of [`${J}/avatar.jpg`, `${J}/photo`, `${J}/x/avatar`, `${J}/avatar/`, `avatar`, `${J}avatar`, `${J.toUpperCase()}/avatar`]) {
  r=await up(J,bad); check(`avatars: wrong object name rejected (${bad.replace(J,'<uid>').replace(J.toUpperCase(),'<UID>')})`, denied(r), r);
}
r=await up(null,`${J}/avatar`,'anon'); check('avatars: anon upload rejected', denied(r), r);
r=await up(null,`/avatar`,'anon'); check('avatars: anon upload with empty uid rejected', denied(r), r);
r=await as(db,'authenticated',K,`update storage.objects set owner=$1 where bucket_id='avatars' and name=$2`,[K,`${J}/avatar`]); check("avatars: other user cannot overwrite someone's avatar (0 rows)", r.ok && r.affected===0, r);
r=await as(db,'authenticated',K,`delete from storage.objects where bucket_id='avatars' and name=$1`,[`${J}/avatar`]); check("avatars: other user cannot delete someone's avatar (0 rows)", r.ok && r.affected===0, r);
r=await as(db,'anon',null,`delete from storage.objects where bucket_id='avatars'`); check('avatars: anon cannot delete (0 rows)', r.ok && r.affected===0, r);
r=await as(db,'authenticated',J,`update storage.objects set owner=$1 where bucket_id='avatars' and name=$2`,[J,`${J}/avatar`]); check('avatars: owner can replace own avatar (upsert path)', r.ok && r.affected===1, r);
r=await as(db,'authenticated',J,`update storage.objects set name=$1 where bucket_id='avatars' and name=$2`,[`${K}/avatar`,`${J}/avatar`]); check("avatars: owner cannot rename own avatar into another user's path", denied(r), r);
r=await as(db,'authenticated',J,`update storage.objects set bucket_id='recipe-media' where bucket_id='avatars' and name=$1`,[`${J}/avatar`]); check('avatars: owner cannot move own avatar into another bucket', denied(r), r);
r=await as(db,'authenticated',J,`select count(*)::int c from storage.objects where bucket_id='avatars'`); check('avatars: owner can list own avatar', r.ok && r.rows[0].c===1, r);
r=await as(db,'authenticated',K,`select count(*)::int c from storage.objects where bucket_id='avatars'`); check("avatars: other users cannot list someone's avatar", r.ok && r.rows[0].c===0, r);
r=await as(db,'anon',null,`select count(*)::int c from storage.objects where bucket_id='avatars'`); check('avatars: anon cannot list the bucket', r.ok && r.rows[0].c===0, r);
r=await as(db,'authenticated',J,`insert into storage.objects (bucket_id,name) values ('recipe-media',$1)`,[`${J}/avatar`]); check('avatars: <uid>/avatar still rejected in recipe-media', denied(r), r);

const AV='https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars';
const setUrl=(uid,url,target=uid)=>as(db,'authenticated',uid,`update public.profiles set avatar_url=$1 where id=$2 returning avatar_url`,[url,target]);
r=await setUrl(J,`${AV}/${J}/avatar?v=1727000000000`); check('avatar_url: own versioned URL accepted (avatarUpload.ts shape)', r.ok && r.rows[0]?.avatar_url?.endsWith('?v=1727000000000'), r);
r=await setUrl(J,`${AV}/${J}/avatar`); check('avatar_url: own unversioned URL accepted', r.ok && r.rows.length===1, r);
for (const [label,url] of [
  ['external URL', 'https://attacker.example/pixel.gif'],
  ["another user's avatar", `${AV}/${K}/avatar?v=1`],
  ['recipe-media object', `https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/recipe-media/${J}/avatar`],
  ['look-alike host', `https://abcdefghijklmnopqrst.supabase.co.evil.example/storage/v1/object/public/avatars/${J}/avatar`],
  ['http (not https)', `http://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars/${J}/avatar`],
  ['extra query', `${AV}/${J}/avatar?v=1&x=https://evil`],
  ['other object name', `${AV}/${J}/avatar.jpg`],
  ['local file URI', 'file:///var/mobile/Containers/Data/Application/X/Documents/avatar.jpg'],
  ['empty string', ''],
]) { r=await setUrl(J,url); check(`avatar_url: ${label} rejected`, !r.ok&&r.code==='23514', r); }
r=await as(db,'authenticated',K,`update public.profiles set avatar_url=$1 where id=$2`,[`${AV}/${K}/avatar`,J]); check("avatar_url: cannot set on someone else's profile (0 rows)", r.ok && r.affected===0, r);
r=await as(db,'authenticated',K,`update public.profiles set avatar_url=null where id=$1`,[J]); check("avatar_url: cannot clear someone else's photo (0 rows)", r.ok && r.affected===0, r);
r=await as(db,'anon',null,`select avatar_url from public.profiles where id=$1`,[J]); check('avatar_url: publicly readable like the rest of the profile', r.ok && r.rows[0]?.avatar_url===`${AV}/${J}/avatar`, r);
r=await setUrl(J,null); check('avatar_url: owner can clear it (null)', r.ok && r.rows[0]?.avatar_url===null, r);
r=await as(db,'authenticated',J,`delete from storage.objects where bucket_id='avatars' and name=$1`,[`${J}/avatar`]); check('avatars: owner can delete own avatar', r.ok && r.affected>=1, r);
r=await as(db,'authenticated',J,`insert into public.profiles (id,username,display_name,avatar_color_seed,avatar_url) values ($1,'x','X','x',$2)`,[L,`${AV}/${J}/avatar`]); check('avatar_url: cannot create a profile row for someone else carrying an avatar_url', !r.ok, r);
await admin(db,`delete from auth.users where id='${L}'`);
r=await up(L,`${L}/avatar`); check('avatars: deleted account with a still-valid JWT cannot upload', denied(r), r);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
