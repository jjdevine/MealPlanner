(function () {
  "use strict";

  const APP_SCHEMA = "mealplanner";
  const SUPABASE_PLACEHOLDER = "https://YOUR_PROJECT_REF.supabase.co";

  const $ = (selector) => document.querySelector(selector);

  const SUPABASE_KEY =
    typeof SUPABASE_ANON_KEY !== "undefined" && SUPABASE_ANON_KEY
      ? SUPABASE_ANON_KEY
      : "";

  const supabaseConfigured =
    typeof window.supabase !== "undefined" &&
    typeof SUPABASE_URL !== "undefined" &&
    SUPABASE_URL &&
    SUPABASE_URL !== SUPABASE_PLACEHOLDER &&
    !/YOUR_PROJECT_REF/i.test(SUPABASE_URL) &&
    SUPABASE_KEY &&
    !/YOUR_SUPABASE_ANON_KEY/i.test(SUPABASE_KEY);

  const supabase = supabaseConfigured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        global: {
          headers: {
            apikey: SUPABASE_KEY,
          },
        },
      })
    : null;

  let currentUser = null;
  let authMode = "signin";
  let editingMealId = null;
  let seasoningTags = [];
  let selectedSeasoningTags = [];
  let meals = [];
  let plans = [];
  let selectedPlanId = null;
  let dayDrafts = {};

  function nowDateIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function setStatus(message, type) {
    const status = $("#status");
    if (!status) return;
    status.textContent = message || "";
    status.classList.remove("error", "success", "info");
    status.classList.add(type || "info");
  }

  function showAuthError(message) {
    const error = $("#auth-error");
    error.textContent = message || "";
    error.classList.remove("hidden");
  }

  function hideAuthError() {
    const error = $("#auth-error");
    error.classList.add("hidden");
    error.textContent = "";
  }

  function showMealFormMessage(message, type) {
    const el = $("#meal-form-message");
    el.textContent = message;
    el.classList.remove("hidden", "error", "success", "info");
    el.classList.add(type || "info");
  }

  function showPlanFormMessage(message, type) {
    const el = $("#plan-form-message");
    el.textContent = message;
    el.classList.remove("hidden", "error", "success", "info");
    el.classList.add(type || "info");
  }

  function clearFormMessage(selector) {
    const el = $(selector);
    el.classList.add("hidden");
    el.textContent = "";
  }

  function setScreen(name) {
    $("#auth-screen").classList.toggle("active", name === "auth");
    $("#main-screen").classList.toggle("active", name === "main");

    const splash = $("#splash-screen");
    if (splash.classList.contains("active")) {
      setTimeout(() => splash.classList.remove("active"), 280);
    }
  }

  function setMainTab(tabName) {
    const mealsTab = $("#open-meals-tab");
    const plansTab = $("#open-plans-tab");
    const mealsPanel = $("#meals-panel");
    const plansPanel = $("#plans-panel");

    const mealsActive = tabName === "meals";
    mealsTab.classList.toggle("active", mealsActive);
    plansTab.classList.toggle("active", !mealsActive);
    mealsPanel.classList.toggle("active", mealsActive);
    mealsPanel.classList.toggle("hidden", !mealsActive);
    plansPanel.classList.toggle("active", !mealsActive);
    plansPanel.classList.toggle("hidden", mealsActive);
  }

  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "id-" + Math.random().toString(36).slice(2, 11);
  }

  function formatDate(isoDate) {
    const date = new Date(isoDate + "T00:00:00");
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function addDays(startDate, add) {
    const date = new Date(startDate + "T00:00:00");
    date.setDate(date.getDate() + add);
    return date.toISOString().slice(0, 10);
  }

  function ingredientRowTemplate(values) {
    const row = document.createElement("div");
    row.className = "ingredient-row";
    row.innerHTML = [
      '<input type="text" class="ingredient-name" placeholder="Ingredient" maxlength="120" required>',
      '<input type="number" class="ingredient-qty" min="0" step="0.01" placeholder="Qty" required>',
      '<input type="text" class="ingredient-unit" placeholder="Unit (g, ml, pcs)" maxlength="30" required>',
      '<button type="button" class="remove-ingredient" title="Remove ingredient">Remove</button>',
    ].join("");

    if (values) {
      row.querySelector(".ingredient-name").value = values.ingredient_name || "";
      row.querySelector(".ingredient-qty").value = values.quantity == null ? "" : String(values.quantity);
      row.querySelector(".ingredient-unit").value = values.unit || "";
    }

    row.querySelector(".remove-ingredient").addEventListener("click", () => {
      row.remove();
      if ($("#ingredient-rows").children.length === 0) {
        addIngredientRow();
      }
    });

    return row;
  }

  function addIngredientRow(values) {
    $("#ingredient-rows").appendChild(ingredientRowTemplate(values));
  }

  function normalizeTagName(input) {
    return String(input || "").trim().replace(/\s+/g, " ");
  }

  function tagKey(name) {
    return normalizeTagName(name).toLowerCase();
  }

  function updateSeasoningTagSuggestions() {
    const list = $("#seasoning-tag-suggestions");
    list.innerHTML = "";
    seasoningTags.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag.name;
      list.appendChild(option);
    });
  }

  function renderSelectedSeasoningTags() {
    const container = $("#selected-seasoning-tags");
    container.innerHTML = "";

    if (!selectedSeasoningTags.length) {
      const empty = document.createElement("p");
      empty.className = "message info";
      empty.textContent = "No seasoning or garnish tags selected.";
      container.appendChild(empty);
      return;
    }

    selectedSeasoningTags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.appendChild(document.createTextNode(tag.name));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove tag " + tag.name);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        selectedSeasoningTags = selectedSeasoningTags.filter((item) => tagKey(item.name) !== tagKey(tag.name));
        renderSelectedSeasoningTags();
      });

      chip.appendChild(remove);
      container.appendChild(chip);
    });
  }

  function addSelectedSeasoningTag(name) {
    const normalized = normalizeTagName(name);
    if (!normalized) return;
    const normalizedKey = tagKey(normalized);
    if (selectedSeasoningTags.some((item) => tagKey(item.name) === normalizedKey)) return;
    selectedSeasoningTags.push({ name: normalized });
    renderSelectedSeasoningTags();
  }

  function handleAddSeasoningTag() {
    const input = $("#seasoning-tag-input");
    addSelectedSeasoningTag(input.value);
    input.value = "";
    input.focus();
  }

  async function loadSeasoningTags() {
    const { data, error } = await supabase
      .schema(APP_SCHEMA)
      .from("seasoning_tags")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) throw error;
    seasoningTags = data || [];
    updateSeasoningTagSuggestions();
  }

  async function ensureSeasoningTagRecords(tagNames) {
    const uniqueNames = Array.from(new Set((tagNames || []).map(normalizeTagName).filter(Boolean)));
    const existingByKey = new Map(seasoningTags.map((tag) => [tagKey(tag.name), tag]));
    const resolved = [];

    for (const name of uniqueNames) {
      const key = tagKey(name);
      let tag = existingByKey.get(key);

      if (!tag) {
        const insertResult = await supabase
          .schema(APP_SCHEMA)
          .from("seasoning_tags")
          .insert({
            id: uuid(),
            created_by_user_id: currentUser.id,
            name,
          })
          .select("id, name")
          .single();

        if (insertResult.error) {
          if (insertResult.error.code !== "23505") throw insertResult.error;

          const existingResult = await supabase
            .schema(APP_SCHEMA)
            .from("seasoning_tags")
            .select("id, name")
            .ilike("name", name)
            .limit(1)
            .maybeSingle();

          if (existingResult.error) throw existingResult.error;
          tag = existingResult.data;
        } else {
          tag = insertResult.data;
        }

        if (!tag) throw new Error("Failed to resolve seasoning tag.");
        existingByKey.set(key, tag);
      }

      resolved.push(tag);
    }

    seasoningTags = Array.from(existingByKey.values()).sort((a, b) => a.name.localeCompare(b.name));
    updateSeasoningTagSuggestions();
    return resolved;
  }

  function readMealForm() {
    const name = $("#meal-name").value.trim();
    const adjustable = $("#meal-adjustable").checked;
    const fixedRaw = $("#meal-fixed-portions").value;
    const fixedPortions = fixedRaw ? Number(fixedRaw) : null;

    const ingredients = Array.from(document.querySelectorAll("#ingredient-rows .ingredient-row"))
      .map((row, idx) => {
        const ingredientName = row.querySelector(".ingredient-name").value.trim();
        const quantityRaw = row.querySelector(".ingredient-qty").value;
        const unit = row.querySelector(".ingredient-unit").value.trim();
        return {
          ingredient_name: ingredientName,
          quantity: quantityRaw ? Number(quantityRaw) : null,
          unit,
          sort_order: idx,
        };
      })
      .filter((ing) => ing.ingredient_name && ing.quantity != null && ing.unit);

    return {
      name,
      allows_portion_adjustment: adjustable,
      fixed_portions: adjustable ? null : fixedPortions,
      ingredients,
      seasoning_tag_names: selectedSeasoningTags.map((tag) => normalizeTagName(tag.name)).filter(Boolean),
    };
  }

  function validateMealPayload(payload) {
    if (!payload.name) return "Meal name is required.";
    if (!payload.allows_portion_adjustment && (!payload.fixed_portions || payload.fixed_portions < 1)) {
      return "Fixed portions are required for non-adjustable meals.";
    }
    if (!payload.ingredients.length) return "At least one ingredient is required.";
    return null;
  }

  function resetMealForm() {
    editingMealId = null;
    selectedSeasoningTags = [];
    $("#meal-form").reset();
    $("#save-meal-btn").textContent = "Save Meal";
    $("#ingredient-rows").innerHTML = "";
    addIngredientRow();
    renderSelectedSeasoningTags();
    clearFormMessage("#meal-form-message");
  }

  function canEditMeal(meal) {
    return currentUser && meal.owner_user_id === currentUser.id;
  }

  async function loadMeals() {
    const { data, error } = await supabase
      .schema(APP_SCHEMA)
      .from("meals")
      .select("id, owner_user_id, name, allows_portion_adjustment, fixed_portions, created_at, updated_at, meal_ingredients(id, ingredient_name, quantity, unit, sort_order), meal_seasoning_tags(sort_order, seasoning_tags(id, name))")
      .order("created_at", { ascending: false });

    if (error) throw error;

    meals = (data || []).map((meal) => {
      const ingredients = Array.isArray(meal.meal_ingredients) ? meal.meal_ingredients.slice() : [];
      ingredients.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const seasoningTagRows = Array.isArray(meal.meal_seasoning_tags) ? meal.meal_seasoning_tags.slice() : [];
      seasoningTagRows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const mealSeasoningTags = seasoningTagRows
        .map((row) => {
          const seasoningTag = Array.isArray(row.seasoning_tags) ? row.seasoning_tags[0] : row.seasoning_tags;
          if (!seasoningTag || !seasoningTag.name) return null;
          return {
            id: seasoningTag.id,
            name: seasoningTag.name,
          };
        })
        .filter(Boolean);
      return {
        ...meal,
        meal_ingredients: ingredients,
        seasoning_tags: mealSeasoningTags,
      };
    });

    renderMeals();
  }

  function mealCardTemplate(meal) {
    const editable = canEditMeal(meal);
    const ownerText = editable ? "Created by you" : "Created by another user";
    const portionRule = meal.allows_portion_adjustment
      ? "Portions: adjustable"
      : "Portions: fixed at " + meal.fixed_portions;

    const card = document.createElement("article");
    card.className = "meal-card";

    const ingredientsHtml = (meal.meal_ingredients || [])
      .map((ing) => '<span class="ingredient-chip">' +
        escapeHtml(ing.ingredient_name) +
        " - " +
        escapeHtml(String(ing.quantity)) + " " +
        escapeHtml(ing.unit) +
      "</span>")
      .join("");
    const seasoningsHtml = (meal.seasoning_tags || [])
      .map((tag) => '<span class="seasoning-chip">' + escapeHtml(tag.name) + "</span>")
      .join("");

    card.innerHTML = [
      '<div class="meal-card-top">',
      "<div>",
      "<h4>" + escapeHtml(meal.name) + "</h4>",
      '<p class="meal-meta">' + escapeHtml(ownerText) + " | " + escapeHtml(portionRule) + "</p>",
      "</div>",
      "</div>",
      '<div class="ingredient-list">' + ingredientsHtml + "</div>",
      seasoningsHtml ? '<div class="ingredient-list"><strong>Seasonings + Garnishes:</strong><div>' + seasoningsHtml + "</div></div>" : "",
      '<div class="card-actions"></div>',
    ].join("");

    const actions = card.querySelector(".card-actions");
    if (editable) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "edit";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => startEditMeal(meal.id));

      const del = document.createElement("button");
      del.type = "button";
      del.className = "delete";
      del.textContent = "Delete";
      del.addEventListener("click", () => deleteMeal(meal.id));

      actions.appendChild(edit);
      actions.appendChild(del);
    } else {
      actions.textContent = "View only";
    }

    return card;
  }

  function renderMeals() {
    const list = $("#meal-list");
    list.innerHTML = "";

    if (!meals.length) {
      const empty = document.createElement("p");
      empty.className = "message info";
      empty.textContent = "No meals yet. Add one to get started.";
      list.appendChild(empty);
      refreshMealPickers();
      renderPlanDays();
      return;
    }

    meals.forEach((meal) => list.appendChild(mealCardTemplate(meal)));
    refreshMealPickers();
    renderPlanDays();
  }

  async function saveMeal(event) {
    event.preventDefault();
    clearFormMessage("#meal-form-message");

    const payload = readMealForm();
    const validationError = validateMealPayload(payload);
    if (validationError) {
      showMealFormMessage(validationError, "error");
      return;
    }

    try {
      const seasoningTagRecords = await ensureSeasoningTagRecords(payload.seasoning_tag_names);
      if (!editingMealId) {
        const mealInsert = {
          id: uuid(),
          owner_user_id: currentUser.id,
          name: payload.name,
          allows_portion_adjustment: payload.allows_portion_adjustment,
          fixed_portions: payload.fixed_portions,
        };

        const mealResult = await supabase.schema(APP_SCHEMA).from("meals").insert(mealInsert).select("id").single();
        if (mealResult.error) throw mealResult.error;

        const mealId = mealResult.data.id;
        const ingredients = payload.ingredients.map((ing) => ({
          id: uuid(),
          meal_id: mealId,
          ingredient_name: ing.ingredient_name,
          quantity: ing.quantity,
          unit: ing.unit,
          sort_order: ing.sort_order,
        }));

        const ingredientResult = await supabase.schema(APP_SCHEMA).from("meal_ingredients").insert(ingredients);
        if (ingredientResult.error) throw ingredientResult.error;

        if (seasoningTagRecords.length) {
          const seasoningRows = seasoningTagRecords.map((tag, idx) => ({
            meal_id: mealId,
            tag_id: tag.id,
            sort_order: idx,
          }));
          const seasoningResult = await supabase.schema(APP_SCHEMA).from("meal_seasoning_tags").insert(seasoningRows);
          if (seasoningResult.error) throw seasoningResult.error;
        }

        showMealFormMessage("Meal created.", "success");
      } else {
        const existing = meals.find((meal) => meal.id === editingMealId);
        if (!existing || !canEditMeal(existing)) {
          showMealFormMessage("You cannot edit this meal.", "error");
          return;
        }

        const updateResult = await supabase
          .schema(APP_SCHEMA)
          .from("meals")
          .update({
            name: payload.name,
            allows_portion_adjustment: payload.allows_portion_adjustment,
            fixed_portions: payload.fixed_portions,
          })
          .eq("id", editingMealId);
        if (updateResult.error) throw updateResult.error;

        const deleteIngResult = await supabase.schema(APP_SCHEMA).from("meal_ingredients").delete().eq("meal_id", editingMealId);
        if (deleteIngResult.error) throw deleteIngResult.error;
        const deleteSeasoningResult = await supabase.schema(APP_SCHEMA).from("meal_seasoning_tags").delete().eq("meal_id", editingMealId);
        if (deleteSeasoningResult.error) throw deleteSeasoningResult.error;

        const ingredients = payload.ingredients.map((ing) => ({
          id: uuid(),
          meal_id: editingMealId,
          ingredient_name: ing.ingredient_name,
          quantity: ing.quantity,
          unit: ing.unit,
          sort_order: ing.sort_order,
        }));

        const ingredientInsert = await supabase.schema(APP_SCHEMA).from("meal_ingredients").insert(ingredients);
        if (ingredientInsert.error) throw ingredientInsert.error;

        if (seasoningTagRecords.length) {
          const seasoningRows = seasoningTagRecords.map((tag, idx) => ({
            meal_id: editingMealId,
            tag_id: tag.id,
            sort_order: idx,
          }));
          const seasoningInsert = await supabase.schema(APP_SCHEMA).from("meal_seasoning_tags").insert(seasoningRows);
          if (seasoningInsert.error) throw seasoningInsert.error;
        }

        showMealFormMessage("Meal updated.", "success");
      }

      resetMealForm();
      await loadMeals();
    } catch (error) {
      console.error(error);
      showMealFormMessage(error.message || "Failed to save meal.", "error");
    }
  }

  function startEditMeal(mealId) {
    const meal = meals.find((item) => item.id === mealId);
    if (!meal || !canEditMeal(meal)) return;

    editingMealId = meal.id;
    $("#meal-name").value = meal.name;
    $("#meal-adjustable").checked = !!meal.allows_portion_adjustment;
    $("#meal-fixed-portions").value = meal.fixed_portions || "";
    $("#save-meal-btn").textContent = "Update Meal";

    $("#ingredient-rows").innerHTML = "";
    (meal.meal_ingredients || []).forEach((ing) => addIngredientRow(ing));
    if (!meal.meal_ingredients || !meal.meal_ingredients.length) {
      addIngredientRow();
    }
    selectedSeasoningTags = (meal.seasoning_tags || []).map((tag) => ({ name: tag.name }));
    renderSelectedSeasoningTags();

    setMainTab("meals");
    showMealFormMessage("Editing your meal.", "info");
  }

  async function deleteMeal(mealId) {
    const meal = meals.find((item) => item.id === mealId);
    if (!meal || !canEditMeal(meal)) return;

    const confirmed = window.confirm("Delete this meal and all its ingredients?");
    if (!confirmed) return;

    try {
      const result = await supabase.schema(APP_SCHEMA).from("meals").delete().eq("id", mealId);
      if (result.error) throw result.error;
      if (editingMealId === mealId) resetMealForm();
      await loadMeals();
      setStatus("Meal deleted.", "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Delete failed.", "error");
    }
  }

  async function loadPlans() {
    const { data, error } = await supabase
      .schema(APP_SCHEMA)
      .from("meal_plan_periods")
      .select("id, owner_user_id, title, start_date, days_count, created_at, updated_at")
      .order("start_date", { ascending: false });

    if (error) throw error;

    plans = data || [];
    const select = $("#plan-select");
    select.innerHTML = "";

    if (!plans.length) {
      selectedPlanId = null;
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No plans yet";
      select.appendChild(option);
      renderPlanDays();
      return;
    }

    plans.forEach((plan) => {
      const option = document.createElement("option");
      option.value = plan.id;
      option.textContent = plan.title + " (" + plan.days_count + " days from " + plan.start_date + ")";
      select.appendChild(option);
    });

    if (!selectedPlanId || !plans.some((plan) => plan.id === selectedPlanId)) {
      selectedPlanId = plans[0].id;
    }
    select.value = selectedPlanId;
    await loadPlanEntries(selectedPlanId);
  }

  async function createPlan(event) {
    event.preventDefault();
    clearFormMessage("#plan-form-message");

    const title = $("#plan-title").value.trim();
    const startDate = $("#plan-start").value;
    const daysCount = Number($("#plan-days").value);

    if (!title || !startDate || !daysCount || daysCount < 1) {
      showPlanFormMessage("Title, start date, and day count are required.", "error");
      return;
    }

    try {
      const insert = await supabase
        .schema(APP_SCHEMA)
        .from("meal_plan_periods")
        .insert({
          id: uuid(),
          owner_user_id: currentUser.id,
          title,
          start_date: startDate,
          days_count: daysCount,
        })
        .select("id")
        .single();

      if (insert.error) throw insert.error;

      $("#plan-form").reset();
      $("#plan-days").value = "7";
      showPlanFormMessage("Plan created.", "success");
      selectedPlanId = insert.data.id;
      await loadPlans();
    } catch (error) {
      console.error(error);
      showPlanFormMessage(error.message || "Failed to create plan.", "error");
    }
  }

  async function loadPlanEntries(planId) {
    dayDrafts = {};
    if (!planId) {
      renderPlanDays();
      return;
    }

    const { data, error } = await supabase
      .schema(APP_SCHEMA)
      .from("meal_plan_entries")
      .select("id, period_id, day_index, scheduled_date, meal_id, portions")
      .eq("period_id", planId)
      .order("day_index", { ascending: true });

    if (error) throw error;

    (data || []).forEach((entry) => {
      dayDrafts[String(entry.day_index)] = {
        id: entry.id,
        meal_id: entry.meal_id,
        portions: entry.portions == null ? "" : String(entry.portions),
        scheduled_date: entry.scheduled_date,
      };
    });

    renderPlanDays();
  }

  function getSelectedPlan() {
    return plans.find((plan) => plan.id === selectedPlanId) || null;
  }

  function getMealById(mealId) {
    return meals.find((meal) => meal.id === mealId) || null;
  }

  function buildDayRows() {
    const plan = getSelectedPlan();
    if (!plan) return [];

    const rows = [];
    for (let index = 0; index < plan.days_count; index += 1) {
      const key = String(index);
      const scheduledDate = addDays(plan.start_date, index);
      const draft = dayDrafts[key] || { meal_id: "", portions: "", scheduled_date: scheduledDate };
      rows.push({
        day_index: index,
        scheduled_date: scheduledDate,
        meal_id: draft.meal_id || "",
        portions: draft.portions || "",
      });
    }
    return rows;
  }

  function createMealSelect(selectedMealId) {
    const select = document.createElement("select");
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Choose meal";
    select.appendChild(empty);

    meals.forEach((meal) => {
      const option = document.createElement("option");
      option.value = meal.id;
      option.textContent = meal.name;
      select.appendChild(option);
    });

    select.value = selectedMealId || "";
    return select;
  }

  function renderPlanDays() {
    const grid = $("#plan-days-grid");
    grid.innerHTML = "";
    const plan = getSelectedPlan();

    if (!plan) {
      const empty = document.createElement("p");
      empty.className = "message info";
      empty.textContent = "Create a plan to start assigning meals.";
      grid.appendChild(empty);
      return;
    }

    if (!meals.length) {
      const emptyMeals = document.createElement("p");
      emptyMeals.className = "message info";
      emptyMeals.textContent = "Add meals before building a plan.";
      grid.appendChild(emptyMeals);
      return;
    }

    buildDayRows().forEach((row) => {
      const wrapper = document.createElement("div");
      wrapper.className = "day-row";

      const label = document.createElement("div");
      label.className = "day-label";
      label.textContent = "Day " + (row.day_index + 1) + " - " + formatDate(row.scheduled_date);

      const mealSelect = createMealSelect(row.meal_id);
      mealSelect.addEventListener("change", () => {
        const selectedMeal = getMealById(mealSelect.value);
        const portionsInput = wrapper.querySelector("input[type=number]");

        if (selectedMeal && !selectedMeal.allows_portion_adjustment) {
          portionsInput.value = selectedMeal.fixed_portions || "";
          portionsInput.disabled = true;
        } else {
          portionsInput.disabled = false;
        }

        const existing = dayDrafts[String(row.day_index)] || {};
        dayDrafts[String(row.day_index)] = {
          ...existing,
          meal_id: mealSelect.value,
          scheduled_date: row.scheduled_date,
          portions: portionsInput.value,
        };
      });

      const portions = document.createElement("input");
      portions.type = "number";
      portions.min = "0.5";
      portions.step = "0.5";
      portions.placeholder = "Portions";
      portions.value = row.portions;
      const selectedMeal = getMealById(row.meal_id);
      if (selectedMeal && !selectedMeal.allows_portion_adjustment) {
        portions.value = selectedMeal.fixed_portions || "";
        portions.disabled = true;
      }
      portions.addEventListener("input", () => {
        const existing = dayDrafts[String(row.day_index)] || {};
        dayDrafts[String(row.day_index)] = {
          ...existing,
          meal_id: mealSelect.value,
          scheduled_date: row.scheduled_date,
          portions: portions.value,
        };
      });

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "save-day";
      saveButton.textContent = "Save";
      saveButton.addEventListener("click", () => saveDay(row.day_index, row.scheduled_date));

      wrapper.appendChild(label);
      wrapper.appendChild(mealSelect);
      wrapper.appendChild(portions);
      wrapper.appendChild(saveButton);
      grid.appendChild(wrapper);
    });
  }

  async function saveDay(dayIndex, scheduledDate) {
    const key = String(dayIndex);
    const draft = dayDrafts[key] || {};
    if (!selectedPlanId) return;

    try {
      if (!draft.meal_id) {
        const removeResult = await supabase
          .schema(APP_SCHEMA)
          .from("meal_plan_entries")
          .delete()
          .eq("period_id", selectedPlanId)
          .eq("day_index", dayIndex);
        if (removeResult.error) throw removeResult.error;
        setStatus("Day cleared.", "success");
        await loadPlanEntries(selectedPlanId);
        return;
      }

      const meal = getMealById(draft.meal_id);
      let portions = draft.portions ? Number(draft.portions) : null;
      if (meal && !meal.allows_portion_adjustment) {
        portions = meal.fixed_portions;
      }
      if (!portions || portions <= 0) {
        setStatus("Portions must be greater than zero.", "error");
        return;
      }

      const upsertResult = await supabase
        .schema(APP_SCHEMA)
        .from("meal_plan_entries")
        .upsert(
          {
            id: draft.id || uuid(),
            period_id: selectedPlanId,
            day_index: dayIndex,
            scheduled_date: scheduledDate,
            meal_id: draft.meal_id,
            portions,
          },
          { onConflict: "period_id,day_index" }
        );

      if (upsertResult.error) throw upsertResult.error;

      setStatus("Saved day " + (dayIndex + 1) + ".", "success");
      await loadPlanEntries(selectedPlanId);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Failed to save day.", "error");
    }
  }

  async function autoSuggestMeals() {
    if (!selectedPlanId) return;
    const plan = getSelectedPlan();
    if (!plan || !meals.length) return;

    const rotated = meals.slice();
    for (let i = rotated.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = rotated[i];
      rotated[i] = rotated[j];
      rotated[j] = temp;
    }

    const rows = [];
    for (let day = 0; day < plan.days_count; day += 1) {
      const meal = rotated[day % rotated.length];
      const portions = meal.allows_portion_adjustment ? 1 : meal.fixed_portions;
      rows.push({
        id: uuid(),
        period_id: selectedPlanId,
        day_index: day,
        scheduled_date: addDays(plan.start_date, day),
        meal_id: meal.id,
        portions,
      });
    }

    try {
      const result = await supabase
        .schema(APP_SCHEMA)
        .from("meal_plan_entries")
        .upsert(rows, { onConflict: "period_id,day_index" });
      if (result.error) throw result.error;
      setStatus("Suggested meals generated.", "success");
      await loadPlanEntries(selectedPlanId);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Auto-suggest failed.", "error");
    }
  }

  async function clearPlanDays() {
    if (!selectedPlanId) return;
    const confirmed = window.confirm("Clear all assigned meals from this plan?");
    if (!confirmed) return;

    try {
      const result = await supabase.schema(APP_SCHEMA).from("meal_plan_entries").delete().eq("period_id", selectedPlanId);
      if (result.error) throw result.error;
      setStatus("Plan days cleared.", "success");
      await loadPlanEntries(selectedPlanId);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Failed to clear plan.", "error");
    }
  }

  function refreshMealPickers() {
    const select = $("#plan-select");
    if (select && plans.length && selectedPlanId) {
      select.value = selectedPlanId;
    }
  }

  function escapeHtml(input) {
    return String(input || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    hideAuthError();

    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;

    if (!email || !password) {
      showAuthError("Email and password are required.");
      return;
    }

    $("#auth-submit").disabled = true;

    try {
      let result;
      if (authMode === "signup") {
        result = await supabase.auth.signUp({ email, password });
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }

      if (result.error) throw result.error;

      if (authMode === "signup" && !result.data.session) {
        showAuthError("Account created. Check your email for verification, then sign in.");
      }
    } catch (error) {
      console.error(error);
      showAuthError(error.message || "Authentication failed.");
    } finally {
      $("#auth-submit").disabled = false;
    }
  }

  async function bootstrapAuthenticatedApp(user) {
    currentUser = user;
    $("#user-email").textContent = user.email || "Signed in";
    setScreen("main");
    setStatus("Loading your data...", "info");

    try {
      await loadSeasoningTags();
      await loadMeals();
      await loadPlans();
      setStatus("Ready.", "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Failed to load data.", "error");
    }
  }

  function bindEvents() {
    $("#auth-form").addEventListener("submit", handleAuthSubmit);

    document.querySelectorAll(".auth-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".auth-tab").forEach((item) => item.classList.remove("active"));
        tab.classList.add("active");
        authMode = tab.dataset.mode;
        $("#auth-submit").textContent = authMode === "signup" ? "Sign Up" : "Sign In";
        $("#auth-password").setAttribute("autocomplete", authMode === "signup" ? "new-password" : "current-password");
        hideAuthError();
      });
    });

    $("#logout-btn").addEventListener("click", async () => {
      await signOut();
      meals = [];
      seasoningTags = [];
      selectedSeasoningTags = [];
      plans = [];
      selectedPlanId = null;
      dayDrafts = {};
      updateSeasoningTagSuggestions();
      renderSelectedSeasoningTags();
      setScreen("auth");
      setStatus("", "info");
    });

    $("#open-meals-tab").addEventListener("click", () => setMainTab("meals"));
    $("#open-plans-tab").addEventListener("click", () => setMainTab("plans"));

    $("#add-ingredient-row").addEventListener("click", () => addIngredientRow());
    $("#add-seasoning-tag").addEventListener("click", handleAddSeasoningTag);
    $("#seasoning-tag-input").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddSeasoningTag();
      }
    });
    $("#clear-meal-form").addEventListener("click", resetMealForm);
    $("#meal-form").addEventListener("submit", saveMeal);

    $("#meal-adjustable").addEventListener("change", () => {
      if ($("#meal-adjustable").checked) {
        $("#meal-fixed-portions").value = "";
      }
    });

    $("#plan-form").addEventListener("submit", createPlan);

    $("#plan-select").addEventListener("change", async (event) => {
      selectedPlanId = event.target.value || null;
      await loadPlanEntries(selectedPlanId);
    });

    $("#auto-suggest-btn").addEventListener("click", autoSuggestMeals);
    $("#clear-plan-btn").addEventListener("click", clearPlanDays);
  }

  async function start() {
    bindEvents();
    $("#plan-start").value = nowDateIso();
    addIngredientRow();
    renderSelectedSeasoningTags();
    setMainTab("meals");

    if (!supabaseConfigured || !supabase) {
      setScreen("auth");
      showAuthError("Supabase is not configured in supabase-config.js.");
      return;
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session && session.user) {
        await bootstrapAuthenticatedApp(session.user);
      } else {
        currentUser = null;
        setScreen("auth");
      }
    });

    const sessionResponse = await supabase.auth.getSession();
    const session = sessionResponse.data.session;
    if (session && session.user) {
      await bootstrapAuthenticatedApp(session.user);
    } else {
      setScreen("auth");
    }
  }

  start().catch((error) => {
    console.error(error);
    setScreen("auth");
    showAuthError("Failed to start app.");
  });
})();
