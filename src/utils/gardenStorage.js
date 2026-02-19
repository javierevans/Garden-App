
const STORAGE_KEY = "garden_planner_state";

export function loadGardenState() {
    const saved=localStorage.getItem(STORAGE_KEY);
    if(!saved)
    {
        return null;
    }
    else {
        return JSON.parse(saved);
    }
}

export function saveGardenState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

}