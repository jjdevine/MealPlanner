# MealPlanner

MealPlanner is a single-page web app modeled after the ToDoMobile architecture.

## Features

- Meals with name, ingredient list, quantities, units, and reusable seasoning/garnish tags
- Portion rules per meal:
  - Adjustable portions
  - Fixed portion recipes
- Meal plans over an adjustable number of days
- Auto-suggest meals for the plan window
- Manual day-by-day meal selection and portion editing
- Supabase-backed multi-user support with ownership-safe editing

## Setup

1. Run the SQL scripts in [migrations/README.md](migrations/README.md).
2. Update [supabase-config.js](supabase-config.js) with your Supabase URL and anon key.
3. Generate cache metadata:
   - npm run build
4. Serve the folder with any static file server.

## Supabase ownership model

- Meals: visible to all authenticated users.
- Meals: editable only by the user who created them.
- Meal plans: visible and editable only to the owner.

## Files

- index.html: app shell and screens
- app.js: SPA behavior and Supabase integration
- styles.css: visual design
- migrations/: Supabase schema and policy scripts
- build.js, sw.js, sw-version.js: offline cache versioning
