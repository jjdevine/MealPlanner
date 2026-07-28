-- 0001_create_mealplanner_schema.sql
-- Creates a dedicated schema and core tables for the MealPlanner app.

create extension if not exists pgcrypto;

create schema if not exists mealplanner;

create or replace function mealplanner.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists mealplanner.meals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  allows_portion_adjustment boolean not null default true,
  fixed_portions numeric(8,2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint meals_name_not_blank check (length(trim(name)) > 0),
  constraint meals_fixed_portion_rule check (
    (allows_portion_adjustment = true and fixed_portions is null)
    or (allows_portion_adjustment = false and fixed_portions is not null and fixed_portions > 0)
  )
);

create table if not exists mealplanner.meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references mealplanner.meals(id) on delete cascade,
  ingredient_name text not null,
  quantity numeric(12,3) not null,
  unit text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint meal_ingredients_name_not_blank check (length(trim(ingredient_name)) > 0),
  constraint meal_ingredients_unit_not_blank check (length(trim(unit)) > 0),
  constraint meal_ingredients_quantity_positive check (quantity > 0)
);

create table if not exists mealplanner.meal_plan_periods (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  start_date date not null,
  days_count integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint meal_plan_periods_title_not_blank check (length(trim(title)) > 0),
  constraint meal_plan_periods_days_count_bounds check (days_count between 1 and 60)
);

create table if not exists mealplanner.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references mealplanner.meal_plan_periods(id) on delete cascade,
  day_index integer not null,
  scheduled_date date not null,
  meal_id uuid not null references mealplanner.meals(id) on delete restrict,
  portions numeric(8,2) not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint meal_plan_entries_day_index_nonnegative check (day_index >= 0),
  constraint meal_plan_entries_portions_positive check (portions > 0),
  constraint meal_plan_entries_unique_day unique (period_id, day_index)
);

create index if not exists idx_meals_owner_user_id on mealplanner.meals(owner_user_id);
create index if not exists idx_meal_ingredients_meal_id on mealplanner.meal_ingredients(meal_id);
create index if not exists idx_meal_plan_periods_owner_user_id on mealplanner.meal_plan_periods(owner_user_id);
create index if not exists idx_meal_plan_entries_period_id on mealplanner.meal_plan_entries(period_id);
create index if not exists idx_meal_plan_entries_meal_id on mealplanner.meal_plan_entries(meal_id);

create trigger meals_set_updated_at
before update on mealplanner.meals
for each row
execute function mealplanner.set_updated_at();

create trigger meal_ingredients_set_updated_at
before update on mealplanner.meal_ingredients
for each row
execute function mealplanner.set_updated_at();

create trigger meal_plan_periods_set_updated_at
before update on mealplanner.meal_plan_periods
for each row
execute function mealplanner.set_updated_at();

create trigger meal_plan_entries_set_updated_at
before update on mealplanner.meal_plan_entries
for each row
execute function mealplanner.set_updated_at();
