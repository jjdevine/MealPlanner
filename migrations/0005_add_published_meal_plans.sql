-- 0005_add_published_meal_plans.sql
-- Adds a published state to meal plans and makes published plans visible to all authenticated users.

alter table mealplanner.meal_plan_periods
add column if not exists published boolean;

update mealplanner.meal_plan_periods
set published = false
where published is null;

alter table mealplanner.meal_plan_periods
alter column published set default false;

alter table mealplanner.meal_plan_periods
alter column published set not null;

drop policy if exists meal_plan_periods_select_own on mealplanner.meal_plan_periods;
drop policy if exists meal_plan_periods_select_visible on mealplanner.meal_plan_periods;
create policy meal_plan_periods_select_visible
on mealplanner.meal_plan_periods
for select
to authenticated
using (owner_user_id = auth.uid() or published = true);

drop policy if exists meal_plan_entries_select_own_periods on mealplanner.meal_plan_entries;
drop policy if exists meal_plan_entries_select_visible_periods on mealplanner.meal_plan_entries;
create policy meal_plan_entries_select_visible_periods
on mealplanner.meal_plan_entries
for select
to authenticated
using (
  exists (
    select 1
    from mealplanner.meal_plan_periods p
    where p.id = period_id
      and (p.owner_user_id = auth.uid() or p.published = true)
  )
);
