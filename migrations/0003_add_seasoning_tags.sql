-- 0003_add_seasoning_tags.sql
-- Adds reusable seasoning/garnish tags and meal-to-tag mapping.

create table if not exists mealplanner.seasoning_tags (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint seasoning_tags_name_not_blank check (length(trim(name)) > 0)
);

create unique index if not exists idx_seasoning_tags_name_lower on mealplanner.seasoning_tags (lower(trim(name)));

create table if not exists mealplanner.meal_seasoning_tags (
  meal_id uuid not null references mealplanner.meals(id) on delete cascade,
  tag_id uuid not null references mealplanner.seasoning_tags(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (meal_id, tag_id)
);

create index if not exists idx_meal_seasoning_tags_meal_id on mealplanner.meal_seasoning_tags(meal_id);
create index if not exists idx_meal_seasoning_tags_tag_id on mealplanner.meal_seasoning_tags(tag_id);

create trigger seasoning_tags_set_updated_at
before update on mealplanner.seasoning_tags
for each row
execute function mealplanner.set_updated_at();

grant select, insert, update, delete on mealplanner.seasoning_tags to authenticated;
grant select, insert, update, delete on mealplanner.meal_seasoning_tags to authenticated;

alter table mealplanner.seasoning_tags enable row level security;
alter table mealplanner.meal_seasoning_tags enable row level security;

drop policy if exists seasoning_tags_select_all on mealplanner.seasoning_tags;
create policy seasoning_tags_select_all
on mealplanner.seasoning_tags
for select
to authenticated
using (true);

drop policy if exists seasoning_tags_insert_own on mealplanner.seasoning_tags;
create policy seasoning_tags_insert_own
on mealplanner.seasoning_tags
for insert
to authenticated
with check (created_by_user_id = auth.uid());

drop policy if exists seasoning_tags_update_own on mealplanner.seasoning_tags;
create policy seasoning_tags_update_own
on mealplanner.seasoning_tags
for update
to authenticated
using (created_by_user_id = auth.uid())
with check (created_by_user_id = auth.uid());

drop policy if exists seasoning_tags_delete_own on mealplanner.seasoning_tags;
create policy seasoning_tags_delete_own
on mealplanner.seasoning_tags
for delete
to authenticated
using (created_by_user_id = auth.uid());

drop policy if exists meal_seasoning_tags_select_all on mealplanner.meal_seasoning_tags;
create policy meal_seasoning_tags_select_all
on mealplanner.meal_seasoning_tags
for select
to authenticated
using (true);

drop policy if exists meal_seasoning_tags_insert_if_meal_owner on mealplanner.meal_seasoning_tags;
create policy meal_seasoning_tags_insert_if_meal_owner
on mealplanner.meal_seasoning_tags
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

drop policy if exists meal_seasoning_tags_update_if_meal_owner on mealplanner.meal_seasoning_tags;
create policy meal_seasoning_tags_update_if_meal_owner
on mealplanner.meal_seasoning_tags
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

drop policy if exists meal_seasoning_tags_delete_if_meal_owner on mealplanner.meal_seasoning_tags;
create policy meal_seasoning_tags_delete_if_meal_owner
on mealplanner.meal_seasoning_tags
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
