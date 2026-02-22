import { useMemo, useState, useEffect } from "react";
import { loadGardenState, saveGardenState } from "../../utils/gardenStorage";

/* ===== Built-in plant library (base) ===== */
const PLANTS = [
  { id: "tomato", type: "Tomato", variety: null, name: "Tomato", emoji: "🍅", image: null },
  { id: "pepper", type: "Pepper", variety: null, name: "Pepper", emoji: "🫑", image: null },
  { id: "carrot", type: "Carrot", variety: null, name: "Carrot", emoji: "🥕", image: null },
  { id: "lettuce", type: "Lettuce", variety: null, name: "Lettuce", emoji: "🥬", image: null },
];

const CUSTOM_PLANTS_KEY = "garden_custom_plants_v1";

/* Utility: clamp input to an integer within a specified range (for rows/cols inputs) */
function clampInt(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

// Main app component
export default function PlannerApp() {
  /* ===== Main garden state ===== */
  const [garden, setGarden] = useState(loadGardenState);
  // Safety check for loading state
  if (!garden) return <div>Loading…</div>;

  /// Getters for active bed and its properties
  const beds = garden.beds;
  //
  const activeBedId = garden.activeBedId;

// find the active bed object based on activeBedId. 
  const activeBed = useMemo(() => {
    return beds.find((b) => b.id === activeBedId);
  }, [beds, activeBedId]);

  /* ===== Custom plants ===== */
  // Load custom plants from localStorage on initial render, and keep in sync whenever they change.
  const [customPlants, setCustomPlants] = useState(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_PLANTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Whenever customPlants changes, save to localStorage
  useEffect(() => {
    localStorage.setItem(CUSTOM_PLANTS_KEY, JSON.stringify(customPlants));
  }, [customPlants]);

  /* ===== Plant selection + remove mode ===== */
  const [selectedPlantId, setSelectedPlantId] = useState("tomato");
  const [removeMode, setRemoveMode] = useState(false);

  /* ===== New custom plant form state ===== */
  const [newPlantType, setNewPlantType] = useState(""); // e.g. "Tomato", "Carrot" (required)
  const [newPlantVariety, setNewPlantVariety] = useState(""); // optional, e.g. "Cherry", "Roma", "Bell"
  const [newPlantEmoji, setNewPlantEmoji] = useState("🌱"); // default emoji for new plants
  const [newPlantImage, setNewPlantImage] = useState(null); // dataURL or null

  // Handle image file input for custom plants, converting to dataURL for storage.
  function handlePlantImageFile(file) {

    // If no file selected, clear the image
    if (!file) {
      setNewPlantImage(null);
      return;
    }

    // keep localStorage sane
    if (file.size > 1024 * 1024) {
      alert("Image too large. Please choose an image under 1MB.");
      return;
    }

    // Convert image file to dataURL for storage
    const reader = new FileReader();
    reader.onload = () => setNewPlantImage(reader.result);
    reader.readAsDataURL(file);
  }

  /* ===== All plants (built-in + custom), sorted alphabetically ===== */
  const allPlantsSorted = useMemo(() => {
    const merged = [...PLANTS, ...customPlants];

    // Normalize plant objects to ensure they all have type, variety, and name properties for consistent sorting and display.
    const normalized = merged.map((p) => ({
      ...p,
      type: p.type ?? p.name,
      variety: p.variety ?? null,
      name: p.name ?? (p.variety ? `${p.type} (${p.variety})` : p.type),
    }));
    // Sort first by type, then by variety (if type is the same), both alphabetically. Custom plants are included in this sorting.
    normalized.sort((a, b) => {
      const aType = a.type.toLowerCase();
      const bType = b.type.toLowerCase();
      if (aType < bType) return -1;
      if (aType > bType) return 1;

      // If types are the same, sort by variety. Plants without a variety will be sorted before those with a variety.
      const aVar = (a.variety ?? "").toLowerCase();
      const bVar = (b.variety ?? "").toLowerCase();
      if (aVar < bVar) return -1;
      if (aVar > bVar) return 1;

      return 0;
    });
    return normalized;
  }, [customPlants]);

// Get the currently selected plant object based on selectedPlantId
  const selectedPlant = useMemo(() => {
    return allPlantsSorted.find((p) => p.id === selectedPlantId);
  }, [allPlantsSorted, selectedPlantId]);

  /* ===== Helpers ===== */
  // Creates a new empty bed object with default properties. 
  // This is used when initializing the app for first-time users or when resetting a bed. 
  function updateActiveBed(patch) {

    // This function updates the active bed's properties (like rows, cols, or placements)
    //  by merging the provided patch object into the existing bed data. 
    // It also updates the updatedAt timestamp to reflect the change. 
    // The garden state is then updated immutably to trigger a re-render.
    setGarden((prev) => ({
      ...prev,
      beds: prev.beds.map((bed) =>
        bed.id === prev.activeBedId ? { ...bed, ...patch, updatedAt: Date.now() } : bed
      ),
    }));
  }

  // This function toggles the placement of the selected plant in a specific cell of the active bed.
  function toggleCell(row, col) {
    const key = `${row},${col}`; // Create a key for the placements object based on row and column indices.

    // Update the garden state by modifying the placements of the active bed.
    setGarden((prev) => ({
      ...prev,
      beds: prev.beds.map((bed) => {
        // If this is not the active bed, return it unchanged.
        if (bed.id !== prev.activeBedId) return bed;

        const updatedPlacements = { ...(bed.placements || {}) };

        // If removeMode is active, delete the plant from this cell. 
        // Otherwise, set the selected plant in this cell.
        if (removeMode) {
          delete updatedPlacements[key];
        } else {
          updatedPlacements[key] = selectedPlantId;
        }

        return { ...bed, placements: updatedPlacements, updatedAt: Date.now() };
      }),
    }));
  }

  // This function creates a new bed with a user-provided name and adds it to the garden state.
  function addBed() {
    const name = prompt("Bed name?");
    // If the user cancels the prompt or enters an empty name, do nothing.
    if (!name) return;

    // Create a new bed object with a unique ID, the provided name, default dimensions, and an empty placements object.
    const newBed = {
      id: `bed_${Math.random().toString(36).slice(2, 9)}`,
      name: name.trim(),
      rows: 4,
      cols: 6,
      placements: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Update the garden state by adding the new bed to the beginning of the beds array and setting it as the active bed.
    setGarden((prev) => ({
      ...prev,
      beds: [newBed, ...prev.beds],
      activeBedId: newBed.id,
    }));
  }

  // This function deletes the currently active bed from the garden state after confirming with the user.
  function deleteBed() {
    if (beds.length <= 1) return;

    //
    const confirmDelete = window.confirm(
      `Delete "${activeBed?.name ?? "this bed"}"? This cannot be undone.`
    );
    // If the user does not confirm the deletion, do nothing.
    if (!confirmDelete) return;

    // Update the garden state by filtering out the active bed from the beds array.
    setGarden((prev) => {
      const updatedBeds = prev.beds.filter((bed) => bed.id !== prev.activeBedId);

      return {
        ...prev,
        beds: updatedBeds,
        activeBedId: updatedBeds[0].id,
      };
    });
  }

  // This function handles the submission of the form to add a new custom plant.
  function addCustomPlant(e) {
    e.preventDefault();

    // Validate the input for the new plant. The type is required, while variety and emoji are optional.
    const type = newPlantType.trim(); // required
    const variety = newPlantVariety.trim(); // optional
    const emoji = newPlantEmoji.trim() || "🌱"; //optional

    // If the plant type is empty, alert the user and do not add the plant.
    if (!type) {
      alert("Please enter a plant type (required).");
      return;
    }

  
    const id = `custom_${Math.random().toString(36).slice(2, 10)}`;

    // Create a new plant object with a unique ID, the provided type, variety, emoji, and optional image.
    const plant = {
      id,
      type,
      variety: variety || null,
      name: variety ? `${type} (${variety})` : type,
      emoji,
      image: newPlantImage,
      isCustom: true,
      createdAt: Date.now(),
    };

    // Update the custom plants state by adding the new plant to the beginning of the customPlants array, and set it as the selected plant.
    setCustomPlants((prev) => [plant, ...prev]);
    setSelectedPlantId(id);

  
    setNewPlantType("");
    setNewPlantVariety("");
    setNewPlantEmoji("🌱");
    setNewPlantImage(null);
  }

  /* Save garden state whenever it changes */
  useEffect(() => {
    saveGardenState({ ...garden, selectedPlantId });
  }, [garden, selectedPlantId]);

  /* Safety */
  if (!activeBed) return <div>Loading…</div>; //  in case the activeBedId is invalid, we show a loading state instead of crashing.

  /* Render the main app */
  // The main render of the app consists of two sections: a control panel with inputs and 
  // buttons for managing the garden, and a grid representing the active garden bed where plants can be placed. 
  // The control panel includes inputs for adjusting the number of rows and columns, toggling remove mode, switching between beds, 
  // selecting plants, and adding new beds or custom plants. 
  // The grid displays the layout of the active bed, allowing users to click on cells to place or remove plants based on the current selection and mode.
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
        {/* Column Input */}
        <label style={{ display: "grid", gap: 6 }}>
          <span>Columns</span>
          <input
            type="number"
            value={activeBed.cols}
            min={1}
            max={20}
            onChange={(e) => updateActiveBed({ cols: clampInt(e.target.value, 1, 20) })}
          />
        </label>

        {/* Remove Mode Toggle */}
        <label style={{ display: "grid", gap: 6 }}>
          <span>Remove Mode</span>
          <input
            type="checkbox"
            checked={removeMode}
            onChange={(e) => setRemoveMode(e.target.checked)}
          />
        </label>

        {/* Row Input */}
        <label style={{ display: "grid", gap: 6 }}>
          <span>Rows</span>
          <input
            type="number"
            value={activeBed.rows}
            min={1}
            max={20}
            onChange={(e) => updateActiveBed({ rows: clampInt(e.target.value, 1, 20) })}
          />
        </label>

        {/* Bed Switcher */}
        <label style={{ display: "grid", gap: 6 }}>
          <span>Garden Bed</span>
          <select
            value={activeBedId}
            onChange={(e) => setGarden((prev) => ({ ...prev, activeBedId: e.target.value }))}
          >
            {beds.map((bed) => (
              <option key={bed.id} value={bed.id}>
                {bed.name}
              </option>
            ))}
          </select>
        </label>

        {/* Plant Selection Dropdown (alphabetical, includes custom plants) */}
        <label style={{ display: "grid", gap: 6 }}>
          <span>Selected Plant</span>
          <select value={selectedPlantId} onChange={(e) => setSelectedPlantId(e.target.value)}>
            {allPlantsSorted.map((plant) => (
              <option key={plant.id} value={plant.id}>
                {plant.emoji} {plant.variety ? `${plant.type} (${plant.variety})` : plant.type}
              </option>
            ))}
          </select>
        </label>

        {/* Clear Garden Button */}
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

        <button onClick={addBed} style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc" }}>
          + New Bed
        </button>

        <button
          onClick={deleteBed}
          disabled={beds.length <= 1}
          style={{
            padding: 8,
            borderRadius: 8,
            border: "1px solid #ccc",
            cursor: beds.length <= 1 ? "not-allowed" : "pointer",
            opacity: beds.length <= 1 ? 0.6 : 1,
          }}
        >
          Delete Bed
        </button>

        {/* ===== Add Custom Plant Form ===== */}
        <form
          onSubmit={addCustomPlant}
          style={{
            gridColumn: "1 / -1",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 120px 1fr",
            gap: 10,
            paddingTop: 10,
            borderTop: "1px solid #eee",
            marginTop: 10,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span>Plant (required)</span>
            <input
              value={newPlantType}
              onChange={(e) => setNewPlantType(e.target.value)}
              placeholder="e.g., Tomato"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Variety (optional)</span>
            <input
              value={newPlantVariety}
              onChange={(e) => setNewPlantVariety(e.target.value)}
              placeholder="e.g., Sun Gold"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Emoji</span>
            <input
              value={newPlantEmoji}
              onChange={(e) => setNewPlantEmoji(e.target.value)}
              maxLength={2}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Photo (optional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handlePlantImageFile(e.target.files?.[0])}
            />
          </label>

          {newPlantImage ? (
            <img
              src={newPlantImage}
              alt="Preview"
              style={{
                gridColumn: "1 / -1",
                maxWidth: 120,
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />
          ) : null}

          <button
            type="submit"
            style={{
              gridColumn: "1 / -1",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          >
            Add Custom Plant
          </button>

          {/* Optional tiny debug */}
          {/* <div style={{ gridColumn: "1 / -1" }}>Selected: {selectedPlant?.name ?? "none"}</div> */}
        </form>
      </div>

      {/* Garden Bed Grid Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${activeBed.cols}, 52px)`,
          gap: 8,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          width: "fit-content",
        }}
      >
        {Array.from({ length: activeBed.rows }).map((_, rowIndex) =>
          Array.from({ length: activeBed.cols }).map((_, colIndex) => {
            const key = `${rowIndex},${colIndex}`;

            const plantId = (activeBed.placements || {})[key];
            const plant = allPlantsSorted.find((p) => p.id === plantId);

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
                  display: "grid",
                  placeItems: "center",
                }}
                aria-label={
                  plant
                    ? `Cell ${rowIndex + 1},${colIndex + 1}: ${plant.name}`
                    : `Cell ${rowIndex + 1},${colIndex + 1}: empty`
                }
              >
                {plant ? (
                  plant.image ? (
                    <img
                      src={plant.image}
                      alt={plant.name}
                      style={{
                        width: 32,
                        height: 32,
                        objectFit: "cover",
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    plant.emoji
                  )
                ) : (
                  ""
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}