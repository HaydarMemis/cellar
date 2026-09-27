-- Recipe content validation + a database-enforced visibility invariant.
--
-- Two real gaps closed here:
--
-- 1. `public.recipes` had no `visibility` column at all. The "only
--    published recipes are ever synced here" guarantee existed purely as
--    an application-layer promise (only RemoteRecipeBackend.publishRecipe
--    ever inserts a row, and only the client's own code decides to call
--    it). RLS's `select using (true)` policy is only actually safe because
--    of that promise — nothing in the database itself enforced it. A
--    client bug, a future code path, or a compromised device could insert
--    a private recipe and it would be world-readable with no second line
--    of defense. Adding the column with a CHECK constraint that currently
--    only allows 'public' makes the invariant a fact of the schema, not
--    just an assumption about the client — if a private-recipe concept is
--    ever added here, the CHECK is the one place to loosen, deliberately.
--
-- 2. Zero backend validation existed on recipe content — a client could
--    insert an empty name, a negative prep time, an empty ingredients
--    array, or an arbitrarily large payload, and the database would
--    accept it. "Never trust client-side validation alone" (production
--    audit, data validation section) — these CHECK constraints mirror the
--    validation already enforced in app/recipe-editor.tsx, so a malicious
--    or buggy client can no longer bypass it by calling the API directly.

alter table public.recipes
  add column if not exists visibility text not null default 'public' check (visibility = 'public');

alter table public.recipes
  add constraint recipes_name_not_blank check (length(trim(name)) > 0),
  add constraint recipes_name_length check (char_length(name) <= 120),
  add constraint recipes_description_length check (char_length(description) <= 2000),
  add constraint recipes_prep_time_positive check (prep_time_minutes > 0 and prep_time_minutes <= 240),
  add constraint recipes_difficulty_valid check (difficulty in ('easy', 'medium', 'hard')),
  add constraint recipes_ingredients_nonempty check (jsonb_array_length(ingredients) > 0),
  add constraint recipes_ingredients_bounded check (jsonb_array_length(ingredients) <= 40),
  add constraint recipes_steps_nonempty check (array_length(steps, 1) > 0),
  add constraint recipes_steps_bounded check (array_length(steps, 1) <= 30);
