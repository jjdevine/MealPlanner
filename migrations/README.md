# MealPlanner Supabase migrations

Run these scripts in order using the Supabase SQL editor:

1. 0001_create_mealplanner_schema.sql
2. 0002_enable_rls_and_policies.sql

Notes:
- The app uses a dedicated schema named mealplanner (not public).
- Meal data is pooled for read access across authenticated users.
- Users can only edit/delete their own meals.
- Meal plans are private per user by default.
