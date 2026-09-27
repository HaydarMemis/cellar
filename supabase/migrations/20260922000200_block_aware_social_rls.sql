-- Block-aware social interactions.
--
-- Security audit finding: blocking was purely client-side content
-- filtering — it hid a blocked user's recipes from the blocker's own
-- feed, but nothing prevented the BLOCKED user from continuing to like or
-- follow the blocker (or vice versa) via a direct API call. That's a real
-- gap: "can a blocked user still interact with another user's content?"
-- was "yes." These replace the plain ownership-only insert policies with
-- ones that also deny the insert when a block exists in either direction
-- between the two parties involved.
--
-- Unfollow/unlike/unblock remain unrestricted (their own delete policies
-- are untouched) — removing a relationship should never be blocked by a
-- block existing; only *creating* a new interaction is what a block
-- should prevent.

drop policy if exists "a user can like as only themselves" on public.likes;

create policy "a user can like as only themselves, unless blocked either way"
  on public.likes for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1
      from public.recipes r
      join public.blocks b
        on (b.blocker_id = r.owner_id and b.blocked_id = auth.uid())
        or (b.blocker_id = auth.uid() and b.blocked_id = r.owner_id)
      where r.id = recipe_id
    )
  );

drop policy if exists "a user can follow as only themselves" on public.follows;

create policy "a user can follow as only themselves, unless blocked either way"
  on public.follows for insert
  with check (
    auth.uid() = follower_id
    and not exists (
      select 1
      from public.blocks b
      where (b.blocker_id = following_id and b.blocked_id = auth.uid())
         or (b.blocker_id = auth.uid() and b.blocked_id = following_id)
    )
  );
