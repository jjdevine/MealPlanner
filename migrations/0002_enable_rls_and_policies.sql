-- 0002_enable_rls_and_policies.sql
-- Enables row-level security and access policies.

grant usage on schema mealplanner to authenticated;

grant select, insert, update, delete on all tables in schema mealplanner to authenticated;

alter table mealplanner.meals enable row level security;
alter table mealplanner.meal_ingredients enable row level security;
alter table mealplanner.meal_plan_periods enable row level security;
alter table mealplanner.meal_plan_entries enable row level security;

drop policy if exists meals_select_all on mealplanner.meals;
create policy meals_select_all
on mealplanner.meals
for select
to authenticated
using (true);

drop policy if exists meals_insert_own on mealplanner.meals;
create policy meals_insert_own
on mealplanner.meals
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists meals_update_own on mealplanner.meals;
create policy meals_update_own
on mealplanner.meals
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists meals_delete_own on mealplanner.meals;
create policy meals_delete_own
on mealplanner.meals
for delete
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists meal_ingredients_select_all on mealplanner.meal_ingredients;
create policy meal_ingredients_select_all
on mealplanner.meal_ingredients
for select
to authenticated
using (true);

drop policy if exists meal_ingredients_insert_if_meal_owner on mealplanner.meal_ingredients;
create policy meal_ingredients_insert_if_meal_owner
on mealplanner.meal_ingredients
for insert
to authenticated
with check (
  exists (
    select 1
    from mealplanner.meals m
    where m.id = meal_id
      and m.owner_user_id = auth.uid()
  )
);

drop policy if exists meal_ingredients_update_if_meal_owner on mealplanner.meal_ingredients;
create policy meal_ingredients_update_if_meal_owner
on mealplanner.meal_ingredients
for update
to authenticated
using (
  exists (
    select 1
    from mealplanner.meals m
    where m.id = meal_id
      and m.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from mealplanner.meals m
    where m.id = meal_id
      and m.owner_user_id = auth.uid()
  )
);

drop policy if exists meal_ingredients_delete_if_meal_owner on mealplanner.meal_ingredients;
create policy meal_ingredients_delete_if_meal_owner
on mealplanner.meal_ingredients
for delete
to authenticated
using (
  exists (
    select 1
    from mealplanner.meals m
    where m.id = meal_id
      and m.owner_user_id = auth.uid()
  )
);

drop policy if exists meal_plan_periods_select_own on mealplanner.meal_plan_periods;
create policy meal_plan_periods_select_own
on mealplanner.meal_plan_periods
for select
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists meal_plan_periods_insert_own on mealplanner.meal_plan_periods;
create policy meal_plan_periods_insert_own
on mealplanner.meal_plan_periods
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists meal_plan_periods_update_own on mealplanner.meal_plan_periods;
create policy meal_plan_periods_update_own
on mealplanner.meal_plan_periods
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists meal_plan_periods_delete_own on mealplanner.meal_plan_periods;
create policy meal_plan_periods_delete_own
on mealplanner.meal_plan_periods
for delete
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists meal_plan_entries_select_own_periods on mealplanner.meal_plan_entries;
create policy meal_plan_entries_select_own_periods
on mealplanner.meal_plan_entries
for select
to authenticated
using (
  exists (
    select 1
    from mealplanner.meal_plan_periods p
    where p.id = period_id
      and p.owner_user_id = auth.uid()
  )
);

drop policy if exists meal_plan_entries_insert_own_periods on mealplanner.meal_plan_entries;
create policy meal_plan_entries_insert_own_periods
on mealplanner.meal_plan_entries
for insert
to authenticated
with check (
  exists (
    select 1
    from mealplanner.meal_plan_periods p
    where p.id = period_id
      and p.owner_user_id = auth.uid()
  )
);

drop policy if exists meal_plan_entries_update_own_periods on mealplanner.meal_plan_entries;
create policy meal_plan_entries_update_own_periods
on mealplanner.meal_plan_entries
for update
to authenticated
using (
  exists (
    select 1
    from mealplanner.meal_plan_periods p
    where p.id = period_id
      and p.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from mealplanner.meal_plan_periods p
    where p.id = period_id
      and p.owner_user_id = auth.uid()
  )
);

drop policy if exists meal_plan_entries_delete_own_periods on mealplanner.meal_plan_entries;
create policy meal_plan_entries_delete_own_periods
on mealplanner.meal_plan_entries
for delete
to authenticated
using (
  exists (
    select 1
    from mealplanner.meal_plan_periods p
    where p.id = period_id
      and p.owner_user_id = auth.uid()
  )
);
