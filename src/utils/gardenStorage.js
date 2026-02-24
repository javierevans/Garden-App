const STORAGE_KEY = "garden_planner_state";
const VERSION = 1;

// Generates a simple random id for each bed
function makeId() {
  return `bed_${Math.random().toString(36).slice(2, 9)}`;
}
// ceates a new empty bed object with default or provided name, rows, and columns
export function makeEmptyBed({ name = "New Bed", rows = 6, cols = 4 } = {}) {
  const now = Date.now();

  return {
    id: makeId(),
    name,
    rows,
    cols,
    placements: {}, // empty object to hold plant placements keyed by "row,col"
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

//loads the entire garden state from localStorage, or returns null if not found
export function loadGardenState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    // first-time user
    if (!saved) {
      const firstBed = makeEmptyBed({ name: " My First Bed" });
      return {
        version: VERSION,
        activeBedId: firstBed.id,
        beds: [firstBed],
        gardenStartISO: new Date().toISOString(),
        harvests: [], // initialize empty harvests array for tracking harvested plants
      };
    }

    const parsed = JSON.parse(saved);
    // Backwards compatibility: older saved states won't have gardenStartISO
    if (!parsed.gardenStartISO) {
      parsed.gardenStartISO = new Date().toISOString();
    }

    // validate shape of parsed data, if invalid, return a default state with one empty bed.
    // This handles cases where localStorage might be corrupted or have unexpected data.
    if (!parsed || !Array.isArray(parsed.beds) || parsed.beds.length === 0) {
      const firstBed = makeEmptyBed({ name: " My First Bed" });
      return {
        version: VERSION,
        activeBedId: firstBed.id,
        beds: [firstBed],
        gardenStartISO: new Date().toISOString(),
      };
    }

    // Ensure activeBedId exists
    const activeExists = parsed.beds.some((b) => b.id === parsed.activeBedId);
    if (!activeExists) {
      parsed.activeBedId = parsed.beds[0].id;
    }

    return parsed;
  } catch (err) {
    console.error("Failed to load garden state:", err);

    const firstBed = makeEmptyBed({ name: " My First Bed" });

    return {
      version: VERSION,
      activeBedId: firstBed.id,
      beds: [firstBed],
      gardenStartISO: new Date().toISOString(),
    };
  }
}

// calculates the current garden day number based on the provided garden start date in ISO format.
// It compares the start date to the current date, ignoring time-of-day, and returns the number of days that have passed since the garden started, plus one (so the start day is Day 1).
export function getCurrentGardenDay(gardenStartISO) {
  const startDate = new Date(gardenStartISO);
  const now = new Date();

  // Convert both to "midnight" so time-of-day doesn't mess up the day count
  const startMidnight = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  );
  const nowMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((nowMidnight - startMidnight) / msPerDay);

  return diffDays + 1; // Day 1 on start date
}

// saves entire garden state to localStorage as a JSON string under the STORAGE_KEY. This is called
// whenever the user makes changes to ensure their work is preserved across page reloads.
export function saveGardenState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
