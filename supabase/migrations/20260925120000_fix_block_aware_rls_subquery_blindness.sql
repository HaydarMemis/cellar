-- FIX: the block-aware RLS added in 20260922000200 never actually worked.
--
-- Found by live adversarial testing against the real project (a blocked
-- user successfully liked and followed the person who blocked them), not
-- by code review — the original SQL *looks* correct, which is exactly why
-- this class of bug survives static review.
--
-- Root cause: a policy's own subquery is itself subject to RLS. The old
-- policies asked
--
--   not exists (select 1 from public.blocks b where ... )
--
-- evaluated AS THE INSERTING USER. But `blocks` has a SELECT policy of
-- "a user can read only their own block list" (blocker_id = auth.uid()),
-- and the blocked user is never the blocker — so the blocked user's
-- subquery sees ZERO rows, `not exists (...)` is trivially true, and the
-- insert is allowed. Proven live: service_role saw the block row, the
-- blocked user saw 0 rows of `blocks`, and both the like and the follow
-- went through.
--
-- Fix: do the block lookup inside a SECURITY DEFINER function, which runs
-- with the definer's privileges and therefore bypasses RLS on `blocks`.
--
-- Both helpers deliberately take only the OTHER party (never an arbitrary
-- pair) and resolve the caller through auth.uid() internally, so they can
-- only ever reveal a block relationship the caller is already party to —
-- something they can infer anyway from whether the interaction succeeds.
-- `set search_path = public` is required on a SECURITY DEFINER function to
-- prevent search_path hijacking.

create or replace function public.is_blocked_with(other_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = other_user)
       or (b.blocker_id = other_user and b.blocked_id = auth.uid())
  );
$$;

create or replace function public.is_blocked_from_recipe(target_recipe uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.recipes r
    join public.blocks b
      on (b.blocker_id = r.owner_id and b.blocked_id = auth.uid())
      or (b.blocker_id = auth.uid() and b.blocked_id = r.owner_id)
    where r.id = target_recipe
  );
$$;

revoke all on function public.is_blocked_with(uuid) from public;
revoke all on function public.is_blocked_from_recipe(uuid) from public;
grant execute on function public.is_blocked_with(uuid) to authenticated;
grant execute on function public.is_blocked_from_recipe(uuid) to authenticated;

-- Recreate both INSERT policies against the RLS-bypassing helpers.
-- Unlike/unfollow (DELETE) stay untouched: removing a relationship must
-- never be blocked by a block existing, only creating one.

drop policy if exists "a user can like as only themselves, unless blocked either way" on public.likes;

create policy "a user can like as only themselves, unless blocked either way"
  on public.likes for insert
  with check (
    auth.uid() = user_id
    and not public.is_blocked_from_recipe(recipe_id)
  );

drop policy if exists "a user can follow as only themselves, unless blocked either way" on public.follows;

create policy "a user can follow as only themselves, unless blocked either way"
  on public.follows for insert
  with check (
    auth.uid() = follower_id
    and not public.is_blocked_with(following_id)
  );
