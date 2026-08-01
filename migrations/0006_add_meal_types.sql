-- 0006_add_meal_types.sql
-- Adds per-day meal types (breakfast, dinner, tea) to meal plan entries
-- and per-plan flags to enable or disable each meal type.

-- Add meal_type column to meal_plan_entries, defaulting to 'dinner' for
-- existing rows so that backward compatibility is preserved.
alter table mealplanner.meal_plan_entries
add column if not exists meal_type text not null default 'dinner';

alter table mealplanner.meal_plan_entries
drop constraint if exists meal_plan_entries_meal_type_valid;

alter table mealplanner.meal_plan_entries
add constraint meal_plan_entries_meal_type_valid
check (meal_type in ('breakfast', 'dinner', 'tea'));

-- Replace the unique constraint so each (period, day, meal_type) is unique.
alter table mealplanner.meal_plan_entries
drop constraint if exists meal_plan_entries_unique_day;

alter table mealplanner.meal_plan_entries
drop constraint if exists meal_plan_entries_unique_day_type;

alter table mealplanner.meal_plan_entries
add constraint meal_plan_entries_unique_day_type unique (period_id, day_index, meal_type);

-- Add meal-type enabled flags to meal_plan_periods.
alter table mealplanner.meal_plan_periods
add column if not exists breakfast_enabled boolean;

update mealplanner.meal_plan_periods
set breakfast_enabled = true
where breakfast_enabled is null;

alter table mealplanner.meal_plan_periods
alter column breakfast_enabled set default true;

alter table mealplanner.meal_plan_periods
alter column breakfast_enabled set not null;

alter table mealplanner.meal_plan_periods
add column if not exists dinner_enabled boolean;

update mealplanner.meal_plan_periods
set dinner_enabled = true
where dinner_enabled is null;

alter table mealplanner.meal_plan_periods
alter column dinner_enabled set default true;

alter table mealplanner.meal_plan_periods
alter column dinner_enabled set not null;

alter table mealplanner.meal_plan_periods
add column if not exists tea_enabled boolean;

update mealplanner.meal_plan_periods
set tea_enabled = true
where tea_enabled is null;

alter table mealplanner.meal_plan_periods
alter column tea_enabled set default true;

alter table mealplanner.meal_plan_periods
alter column tea_enabled set not null;

-- Enforce that at least one meal type must remain enabled.
alter table mealplanner.meal_plan_periods
drop constraint if exists meal_plan_periods_at_least_one_meal_type;

alter table mealplanner.meal_plan_periods
add constraint meal_plan_periods_at_least_one_meal_type
check (breakfast_enabled or dinner_enabled or tea_enabled);
