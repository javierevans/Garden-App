import { version } from "react";

const STORAGE_KEY = "garden_planner_state";

// Generates a simple random id for each bed
function makeId(){
    return `bed_${Math.random().toString(36).slice(2, 9)}`;

}
// ceates a new empty bed object with default or provided name, rows, and columns 
export function makeEmptyBed({name="New Bed", rows=6, cols=4} = {}) {
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
  try{
      const saved=localStorage.getItem(STORAGE_KEY);
    
      // first-time user 
      if(!saved)
    {
        const firstBed = makeEmptyBed({name: " My First Bed"});
        return {
            version,
            activeBedId: firstBed.id,
            beds: [firstBed],
        };
    }

    const parsed=JSON.parse(saved);

    // validate shape of parsed data, if invalid, return a default state with one empty bed. 
    // This handles cases where localStorage might be corrupted or have unexpected data.
    if(!parsed || !Array.isArray(parsed.beds) || parsed.beds.length === 0){
       const firstBed = makeEmptyBed({name: " My First Bed"});
        return {
            version: VERSION,
            activeBedId: firstBed.id,
            beds: [firstBed],
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

    const firstBed = makeEmptyBed({name: " My First Bed"});

    return {
        version: VERSION,
        activeBedId: firstBed.id,
        beds: [firstBed],
    };
  }
}

    

// saves entire garden state to localStorage as a JSON string under the STORAGE_KEY. This is called 
// whenever the user makes changes to ensure their work is preserved across page reloads.      
export function saveGardenState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

}