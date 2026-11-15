-- Run once in Supabase SQL Editor. Browser anon/authenticated roles have no access.
begin;
create table if not exists public.sellerflow_runtime (
  id text primary key check (id = 'main'), data jsonb,
  revision bigint not null default 0, updated_at timestamptz not null default now(),
  lease_owner text, lease_until timestamptz
);
create table if not exists public.sellerflow_jobs (
  id text primary key, kind text not null check (kind in ('purchase','invoice','reply','refund','inbox','receipt')),
  payload jsonb not null, status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','needs_review','cancelled')),
  attempts integer not null default 0, owner text, result jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists sellerflow_jobs_status on public.sellerflow_jobs(status, created_at);
alter table public.sellerflow_runtime enable row level security;
alter table public.sellerflow_jobs enable row level security;
revoke all on public.sellerflow_runtime, public.sellerflow_jobs from public, anon, authenticated;
grant all on public.sellerflow_runtime, public.sellerflow_jobs to service_role;
insert into public.sellerflow_runtime(id) values ('main') on conflict do nothing;
-- Import the legacy cloud backup exactly once. Local browser data is never imported implicitly.
do $$ begin
  if to_regclass('public.sellerflow_state') is not null then
    execute 'update public.sellerflow_runtime r set data=s.data, revision=1 from public.sellerflow_state s where r.id=''main'' and s.id=''main'' and r.data is null';
  end if;
end $$;

create or replace function public.sf_runtime_rpc(
  p_action text, p_owner text default null, p_revision bigint default null,
  p_data jsonb default null, p_job jsonb default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.sellerflow_runtime%rowtype; j public.sellerflow_jobs%rowtype;
begin
  select * into r from public.sellerflow_runtime where id='main' for update;
  if not found then raise exception 'runtime row missing'; end if;
  if p_action='load' then
    return jsonb_build_object('ok',true,'exists',r.data is not null,'state',r.data,'revision',r.revision,'updatedAt',r.updated_at);
  end if;
  if p_action='lease' then
    if p_owner is null or length(p_owner)<16 then raise exception 'invalid owner'; end if;
    if r.lease_until>now() and r.lease_owner is distinct from p_owner then return jsonb_build_object('ok',false,'code','BUSY'); end if;
    if r.lease_owner is distinct from p_owner then
      -- Never replay a potentially delivered write after process death.
      update public.sellerflow_jobs set status='needs_review',updated_at=now(),result='{"code":"WORKER_INTERRUPTED"}' where status='running';
    end if;
    update public.sellerflow_runtime set lease_owner=p_owner,lease_until=now()+interval '180 seconds' where id='main';
    return jsonb_build_object('ok',true);
  end if;
  if p_action='release' then
    update public.sellerflow_runtime set lease_owner=null,lease_until=null where id='main' and lease_owner=p_owner;
    return jsonb_build_object('ok',true);
  end if;
  if p_action='save' then
    if r.lease_until>now() and r.lease_owner is distinct from p_owner then return jsonb_build_object('ok',false,'code','BUSY'); end if;
  else
    if r.lease_owner is distinct from p_owner or r.lease_until is null or r.lease_until<=now() then return jsonb_build_object('ok',false,'code','LEASE_LOST'); end if;
    update public.sellerflow_runtime set lease_until=now()+interval '180 seconds' where id='main';
  end if;
  if p_action='renew' then return jsonb_build_object('ok',true); end if;
  if p_action in ('save','finish') then
    if p_data is not null then
      if p_revision is distinct from r.revision then return jsonb_build_object('ok',false,'code','REVISION_CONFLICT','revision',r.revision); end if;
      if jsonb_typeof(p_data->'orders') is distinct from 'array' or jsonb_typeof(p_data->'products') is distinct from 'array' or jsonb_typeof(p_data->'suppliers') is distinct from 'array' or octet_length(p_data::text)>2500000 then raise exception 'invalid runtime state'; end if;
    elsif p_action='save' then raise exception 'missing data';
    end if;
    if p_action='finish' then
      select * into j from public.sellerflow_jobs where id=p_job->>'id' for update;
      if not found or j.owner is distinct from p_owner or j.status<>'running' then return jsonb_build_object('ok',false,'code','JOB_OWNERSHIP'); end if;
      if p_job->>'status' not in ('succeeded','failed','needs_review','cancelled') then raise exception 'invalid finish status'; end if;
      update public.sellerflow_jobs set status=p_job->>'status',result=p_job->'result',updated_at=now() where id=j.id;
    end if;
    if p_data is not null then
      update public.sellerflow_runtime set data=p_data,revision=revision+1,updated_at=now() where id='main' returning * into r;
    end if;
    return jsonb_build_object('ok',true,'revision',r.revision,'updatedAt',r.updated_at);
  end if;
  if p_action='enqueue' then
    if p_job->>'kind' not in ('purchase','invoice','reply','refund','inbox','receipt') or jsonb_typeof(p_job->'payload') is distinct from 'object' or length(p_job->>'id')<>64 then raise exception 'invalid job'; end if;
    insert into public.sellerflow_jobs(id,kind,payload) values(p_job->>'id',p_job->>'kind',p_job->'payload') on conflict do nothing;
    select * into j from public.sellerflow_jobs where id=p_job->>'id';
    if j.payload is distinct from p_job->'payload' or j.kind<>p_job->>'kind' then return jsonb_build_object('ok',false,'code','INTENT_CONFLICT'); end if;
    return jsonb_build_object('ok',true,'job',to_jsonb(j));
  end if;
  if p_action='claim' then
    update public.sellerflow_jobs set status='running',owner=p_owner,attempts=attempts+1,updated_at=now()
      where id=p_job->>'id' and status='queued' and attempts<3 returning * into j;
    return jsonb_build_object('ok',true,'job',case when found then to_jsonb(j) else null end);
  end if;
  if p_action='retry_failed' then
    update public.sellerflow_jobs set status='queued',updated_at=now() where id=p_job->>'id' and status='failed' and attempts<3 returning * into j;
    if not found then return jsonb_build_object('ok',false,'code','NOT_RETRYABLE'); end if;
    return jsonb_build_object('ok',true);
  end if;
  raise exception 'unknown action';
end $$;
revoke all on function public.sf_runtime_rpc(text,text,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sf_runtime_rpc(text,text,bigint,jsonb,jsonb) to service_role;
commit;
