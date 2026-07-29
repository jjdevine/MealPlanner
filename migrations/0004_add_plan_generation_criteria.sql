-- 0004_add_plan_generation_criteria.sql
-- Adds per-plan generation criteria for household size and shared meals.

alter table mealplanner.meal_plan_periods
add column if not exists people_count integer;

update mealplanner.meal_plan_periods
set people_count = 1
where people_count is null or people_count < 1;

alter table mealplanner.meal_plan_periods
alter column people_count set default 1;

alter table mealplanner.meal_plan_periods
alter column people_count set not null;

alter table mealplanner.meal_plan_periods
drop constraint if exists meal_plan_periods_people_count_positive;

alter table mealplanner.meal_plan_periods
add constraint meal_plan_periods_people_count_positive check (people_count > 0);

alter table mealplanner.meal_plan_periods
add column if not exists same_meal_for_all boolean;

update mealplanner.meal_plan_periods
set same_meal_for_all = true
where same_meal_for_all is null;

alter table mealplanner.meal_plan_periods
alter column same_meal_for_all set default true;

alter table mealplanner.meal_plan_periods
alter column same_meal_for_all set not null;
