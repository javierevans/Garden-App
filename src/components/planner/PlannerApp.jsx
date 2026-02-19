import { useMemo, useState, useEffect } from "react";
import { loadGardenState, saveGardenState } from "../../utils/gardenStorage";

/// Static plant data (could be fetched from an API in a real app)
const PLANTS = [
  { id: "tomato", name: "Tomato", emoji: "🍅" },
  { id: "pepper", name: "Pepper", emoji: "🫑" },
  { id: "carrot", name: "Carrot", emoji: "🥕" },
  { id: "lettuce", name: "Lettuce", emoji: "🥬" },
];

/// Utility: clamp input to an integer within a specified range (for rows/cols inputs)
function clampInt(value, min, max) {
  const parsed = Number.parseInt(value, 10);

  // If parsing fails, default to minimum allowed value
  if (Number.isNaN(parsed)) return min;

  // Clamp number between min and max
  return Math.max(min, Math.min(max, parsed));
}

export default function PlannerApp() {
  
  /// Main state: array of garden beds, each with its own rows, columns, and plant placements.
  const [beds, setBeds] = useState([
    { id: "bed-1", name: "Front Bed", rows: 4, cols: 6, placements: {} },
    { id: "bed-2", name: "Back Bed", rows: 4, cols: 6, placements: {} },
  ]);

 // UI state: which bed is currently active/selected for editing.
  const [activeBedId, setActiveBedId] = useState("bed-1");

 // Compute the active bed object from the activeBedId (derived state).
  const activeBed = useMemo(() => {
    return beds.find((b) => b.id === activeBedId);
  }, [activeBedId, beds]);

  // UI state: which plant is currently selected for placement.
  const [selectedPlantId, setSelectedPlantId] = useState(PLANTS[0].id);

  // UI state: whether we're in "remove mode" (clicking cells will remove plants instead of placing).
  const [removeMode, setRemoveMode] = useState(false);

 // Hydration state: track whether we've loaded saved state from localStorage to avoid overwriting it on initial render.
  const [hydrated, setHydrated] = useState(false);

  // Helper function to update properties of the active bed (like rows, cols, or placements).
  function updateActiveBed(patch) {
    setBeds((prevBeds) =>
      prevBeds.map((bed) =>
        bed.id === activeBedId ? { ...bed, ...patch } : bed
      )
    );
  }

  // Handler for when a grid cell is clicked: either place the selected plant or remove it based on the current mode.
  function toggleCell(row, col) {
    const key = `${row},${col}`;

    setBeds((prevBeds) =>
      prevBeds.map((bed) => {
        if (bed.id !== activeBedId) return bed;

        const updatedPlacements = { ...bed.placements };

        if (removeMode) {
          // Remove plant from this cell
          delete updatedPlacements[key];
        } else {
          // Place/replace plant in this cell
          updatedPlacements[key] = selectedPlantId;
        }

        return { ...bed, placements: updatedPlacements };
      })
    );
  }

// Load saved state from localStorage on initial mount (hydration).
  useEffect(() => {
    const saved = loadGardenState();

    if (saved) {
      // Support saved objects that include these fields
      const savedBeds = saved.beds;
      const savedActiveBedId = saved.activeBedId;
      const savedSelectedPlantId = saved.selectedPlantId;

      if (Array.isArray(savedBeds) && savedBeds.length > 0) {
        setBeds(savedBeds);
      }

      if (typeof savedActiveBedId === "string") {
        setActiveBedId(savedActiveBedId);
      }

      if (typeof savedSelectedPlantId === "string") {
        setSelectedPlantId(savedSelectedPlantId);
      }
    }

    setHydrated(true);
  }, []);

 // Save current state to localStorage whenever it changes (but only after hydration to avoid overwriting saved state on initial load).
  useEffect(() => {
    if (!hydrated) return;

    saveGardenState({
      beds,
      activeBedId,
      selectedPlantId,
    });
  }, [hydrated, beds, activeBedId, selectedPlantId]);

 // Compute the currently selected plant object from the selectedPlantId (derived state).
  const selectedPlant = useMemo(
    () => PLANTS.find((p) => p.id === selectedPlantId),
    [selectedPlantId]
  );

  // Safety: if activeBed isn't found (shouldn't happen), avoid crashing.
  if (!activeBed) {
    return <div>Loading…</div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Control Panel Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        {/* Column Input (updates active bed) */}
        <label style={{ display: "grid", gap: 6 }}>
          <span>Columns</span>
          <input
            type="number"
            value={activeBed.cols}
            min={1}
            max={20}
            onChange={(e) =>
              updateActiveBed({ cols: clampInt(e.target.value, 1, 20) })
            }
          />
        </label>

        {/* Remove Mode Toggle (global UI state) */}
        <label style={{ display: "grid", gap: 6 }}>
          <span>Remove Mode</span>
          <input
            type="checkbox"
            checked={removeMode}
            onChange={(e) => setRemoveMode(e.target.checked)}
          />
        </label>

        {/* Row Input (updates active bed) */}
        <label style={{ display: "grid", gap: 6 }}>
          <span>Rows</span>
          <input
            type="number"
            value={activeBed.rows}
            min={1}
            max={20}
            onChange={(e) =>
              updateActiveBed({ rows: clampInt(e.target.value, 1, 20) })
            }
          />
        </label>

        {/* Bed Switcher */}
        <label style={{ display: "grid", gap: 6 }}>
          <span>Garden Bed</span>
          <select
            value={activeBedId}
            onChange={(e) => setActiveBedId(e.target.value)}
          >
            {beds.map((bed) => (
              <option key={bed.id} value={bed.id}>
                {bed.name}
              </option>
            ))}
          </select>
        </label>

        {/* Plant Selection Dropdown */}
        <label style={{ display: "grid", gap: 6 }}>
          <span>Selected Plant</span>
          <select
            value={selectedPlantId}
            onChange={(e) => setSelectedPlantId(e.target.value)}
          >
            {PLANTS.map((plant) => (
              <option key={plant.id} value={plant.id}>
                {plant.emoji} {plant.name}
              </option>
            ))}
          </select>
        </label>

        {/* Clear Garden Button (clears ONLY the active bed) */}
        <button
          onClick={() => updateActiveBed({ placements: {} })}
          style={{
            padding: 8,
            border: "1px solid #ccc",
            borderRadius: 8,
            cursor: "pointer",
          }}
          title={`Clear ${activeBed.name}`}
        >
          Clear Garden
        </button>
      </div>

      {/* Garden Bed Grid Section */}
      <div
        style={{
          display: "grid",
          // IMPORTANT: gridTemplateColumns must use the active bed's cols
          gridTemplateColumns: `repeat(${activeBed.cols}, 52px)`,
          gap: 8,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          width: "fit-content",
        }}
      >
        {/* Render grid cells based on the ACTIVE bed's rows and columns */}
        {Array.from({ length: activeBed.rows }).map((_, rowIndex) =>
          Array.from({ length: activeBed.cols }).map((_, colIndex) => {
            const key = `${rowIndex},${colIndex}`;

            // Look up plant ID in the ACTIVE bed's placements
            const plantId = activeBed.placements[key];
            const plant = PLANTS.find((p) => p.id === plantId);

            return (
              <button
                key={key}
                onClick={() => toggleCell(rowIndex, colIndex)}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: plant ? "#f4f4f4" : "white",
                  cursor: "pointer",
                  fontSize: 22,
                }}
                aria-label={
                  plant
                    ? `Cell ${rowIndex + 1},${colIndex + 1}: ${plant.name}`
                    : `Cell ${rowIndex + 1},${colIndex + 1}: empty`
                }
              >
                {/* Display plant emoji if a plant is placed in this cell */}
                {plant ? plant.emoji : ""}
              </button>
            );
          })
        )}
      </div>

      {/* Optional: tiny debug line so you can see selected plant object exists */}
      {/* <div>Selected: {selectedPlant ? selectedPlant.name : "none"}</div> */}
    </div>
  );
}
