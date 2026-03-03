import { useMemo, useState, useEffect } from "react";
import { fetchWeather } from "../../utils/weather";
import {
  loadGardenState,
  saveGardenState,
  getCurrentGardenDay,
} from "../../utils/gardenStorage";

/* ===== Built-in plant library (base) ===== */
const PLANTS = [
  {
    id: "tomato",
    type: "Tomato",
    variety: null,
    name: "Tomato",
    emoji: "🍅",
    image: null,
    daysToHarvest: 60,
  },
  {
    id: "pepper",
    type: "Pepper",
    variety: null,
    name: "Pepper",
    emoji: "🫑",
    image: null,
    daysToHarvest: 60,
  },
  {
    id: "carrot",
    type: "Carrot",
    variety: null,
    name: "Carrot",
    emoji: "🥕",
    image: null,
    daysToHarvest: 60,
  },
  {
    id: "lettuce",
    type: "Lettuce",
    variety: null,
    name: "Lettuce",
    emoji: "🥬",
    image: null,
    daysToHarvest: 60,
  },
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
  // NOTE: We cannot return early before hooks. We create a safe fallback "safeGarden" first.
  const safeGarden = garden ?? {
    beds: [
      {
        id: "bed_default",
        name: "My Bed",
        rows: 4,
        cols: 6,
        placements: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    activeBedId: "bed_default",
    gardenStartISO: new Date().toISOString(),
    harvests: [],
  };

  /// Getters for active bed and its properties
  const beds = safeGarden.beds;
  //
  const activeBedId = safeGarden.activeBedId;

  // find the active bed object based on activeBedId.
  const activeBed = useMemo(() => {
    return beds.find((b) => b.id === activeBedId);
  }, [beds, activeBedId]);

  /* ===== Custom plants ===== */
  // Load custom plants once on startup (from localStorage).
  const [customPlants, setCustomPlants] = useState(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_PLANTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Persist custom plants whenever they change.
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
  const [newPlantDaysToHarvest, setNewPlantDaysToHarvest] = useState(""); // optional number of days to harvest

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

  /* ===== Garden state management functions ===== */
  const [selectedCellKey, setSelectedCellKey] = useState(null);

  /* he current garden day number, calculated based on the garden's start date. */
  const [selectedGardenDay, setSelectedGardenDay] = useState(1);

  const currentGardenDay = getCurrentGardenDay(safeGarden.gardenStartISO);

  /* ===== Weather (bonus) ===== */
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    async function loadWeather() {
      const data = await fetchWeather(40.7128, -74.006); // Example: New York City coordinates
      setWeather(data);
    }
    loadWeather();
  }, []); // Empty dependency array means this runs once on mount

  // ===== Weather-derived tip (simple rules) =====
  const maxTemp = weather?.daily?.temperature_2m_max?.[0] ?? null;
  const rainChance = weather?.daily?.precipitation_probability_max?.[0] ?? null;

  let weatherTip = "Weather tip: —";

  if (rainChance !== null && rainChance >= 60) {
    weatherTip = "Weather tip: Rain likely today — consider skipping watering.";
  } else if (maxTemp !== null && maxTemp >= 85) {
    weatherTip = "Weather tip: Hot day — check soil and water if needed.";
  } else if (maxTemp !== null) {
    weatherTip =
      "Weather tip: Normal conditions — water based on soil moisture.";
  }

  /* ===== Helpers ===== */

  // updateActiveBed(patch)
  // Updates ONLY the active bed (rows/cols/placements) immutably.
  function updateActiveBed(patch) {
    setGarden((prev) => {
      const base =
        prev ??
        safeGarden; /* if prev is ever null, fallback so we don't crash */

      return {
        ...base,
        beds: base.beds.map((bed) =>
          bed.id === base.activeBedId
            ? { ...bed, ...patch, updatedAt: Date.now() }
            : bed,
        ),
      };
    });
  }

  // This function toggles the placement of the selected plant in a specific cell of the active bed.
  function toggleCell(row, col) {
    const key = `${row},${col}`; // Create a key for the placements object based on row and column indices.

    // Update the garden state by modifying the placements of the active bed.
    setGarden((prev) => {
      const base = prev ?? safeGarden;

      return {
        ...base,
        beds: base.beds.map((bed) => {
          // If this is not the active bed, return it unchanged.
          if (bed.id !== base.activeBedId) return bed;

          const updatedPlacements = { ...(bed.placements || {}) };

          // If removeMode is active, delete the plant from this cell.
          // Otherwise, set the selected plant in this cell.
          if (removeMode) {
            delete updatedPlacements[key];
          } else {
            updatedPlacements[key] = {
              plantId: selectedPlantId,
              plantedOnGardenDay: currentGardenDay,
              entriesByGardenDay: {}, // notes/photos stored per garden day
            };
          }

          return {
            ...bed,
            placements: updatedPlacements,
            updatedAt: Date.now(),
          };
        }),
      };
    });
  }

  // placeSelectedPlant()
  // Writes the current selected plant into the selected cell.
  function placeSelectedPlant() {
    if (!selectedCellKey) return;

    const updatedPlacements = { ...(activeBed.placements || {}) }; // create a shallow copy of the current placements to modify

    const currentGardenDay = getCurrentGardenDay(safeGarden.gardenStartISO); // calculate the current garden day number based on the garden's start date

    updatedPlacements[selectedCellKey] = {
      // set the selected plant in the specified cell with its ID, the current garden day, and an empty logs array for future notes/photos.
      plantId: selectedPlantId,
      plantedOnGardenDay: currentGardenDay,
      entriesByGardenDay: {}, // notes/photos stored per garden day
    };

    updateActiveBed({ placements: updatedPlacements });
  }

  function removePlantFromSelectedCell() {
    if (!selectedCellKey) return;
    const updatedPlacements = { ...(activeBed.placements || {}) };
    delete updatedPlacements[selectedCellKey];
    updateActiveBed({ placements: updatedPlacements });
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
    setGarden((prev) => {
      const base = prev ?? safeGarden;

      return {
        ...base,
        beds: [newBed, ...base.beds],
        activeBedId: newBed.id,
      };
    });
  }

  // This function deletes the currently active bed from the garden state after confirming with the user.
  function deleteBed() {
    if (beds.length <= 1) return;

    //
    const confirmDelete = window.confirm(
      `Delete "${activeBed?.name ?? "this bed"}"? This cannot be undone.`,
    );
    // If the user does not confirm the deletion, do nothing.
    if (!confirmDelete) return;

    // Update the garden state by filtering out the active bed from the beds array.
    setGarden((prev) => {
      const base = prev ?? safeGarden;

      const updatedBeds = base.beds.filter(
        (bed) => bed.id !== base.activeBedId,
      );

      return {
        ...base,
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
    const daysToHarvest = newPlantDaysToHarvest.trim()
      ? Number(newPlantDaysToHarvest.trim())
      : null; // optional number of days to harvest

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
      daysToHarvest,
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
    setNewPlantDaysToHarvest("");
  }

  /* Safety */
  // ===== Selected cell + derived plant info =====
  const selectedCell = selectedCellKey
    ? (activeBed?.placements || {})[selectedCellKey]
    : null;

  const selectedPlantIdFromCell = selectedCell?.plantId ?? null;

  const selectedPlantFromCell = selectedPlantIdFromCell
    ? allPlantsSorted.find((p) => p.id === selectedPlantIdFromCell)
    : null;

  // Notes should be available for the whole plant timeline (not just days since app start).
  const maxNoteDay =
    selectedPlantFromCell?.daysToHarvest ?? selectedPlant?.daysToHarvest ?? 120;
  const noteDayOptions = Array.from({ length: maxNoteDay }, (_, i) => i + 1);

  // Journal note draft for selected plant + selected day
  const [noteDraft, setNoteDraft] = useState("");

  /* This function saves a note for the currently selected cell and garden day. 
It updates the placements of the active bed by adding or updating the note in the entriesByGardenDay object for the specific cell and garden day. */

  function saveNoteForSelectedDay() {
    if (!selectedCellKey || !selectedCell) return;

    const updatedPlacements = { ...(activeBed.placements || {}) };
    const prevPlacement = updatedPlacements[selectedCellKey];

    updatedPlacements[selectedCellKey] = {
      ...prevPlacement,
      entriesByGardenDay: {
        ...(prevPlacement.entriesByGardenDay || {}),
        [selectedGardenDay]: noteDraft.trim(),
      },
    };

    updateActiveBed({ placements: updatedPlacements });
  }

  /* This function allows the user to set the current growth day of a plant in the selected cell by prompting the user for input.*/
  function setPlantCurrentDayFromUser() {
    if (!selectedCellKey || !selectedCell) return;

    const raw = prompt("What day is this plant currently on? (ex: 20)", "1");
    const assumedPlantDay = Number(raw);

    if (!assumedPlantDay || assumedPlantDay < 1) return;

    // Back-calc plantedOnGardenDay so your existing progress math still works.
    // Clamp to 1 so we never get negative garden days.
    let newPlantedOnGardenDay = currentGardenDay - assumedPlantDay + 1;
    if (newPlantedOnGardenDay < 1) newPlantedOnGardenDay = 1;

    const updatedPlacements = { ...(activeBed.placements || {}) };
    const prevPlacement = updatedPlacements[selectedCellKey];

    updatedPlacements[selectedCellKey] = {
      ...prevPlacement,
      plantedOnGardenDay: newPlantedOnGardenDay,
    };

    updateActiveBed({ placements: updatedPlacements });
  }

  /* harvest log */
  function logHarvest() {
    if (!selectedCell || !selectedPlantFromCell) return;

    const quantity = Number(prompt("How many did you harvest?", "1"));

    if (!quantity || quantity <= 0) return;

    const newHarvest = {
      id: `harvest_${Math.random().toString(36).slice(2, 9)}`,
      plantId: selectedPlantFromCell.id,
      bedId: activeBed.id,
      celkey: selectedCellKey,
      gardenDay: currentGardenDay,
      quantity,
      unit: "count",
      createdAt: Date.now(),
    };

    // Add the new harvest entry to the garden state. The harvests array is stored at the top level of the garden state for easy access and tracking of all harvests across beds and plants.
    setGarden((prev) => {
      const base = prev ?? safeGarden;

      return {
        ...base,
        harvests: [...(base.harvests || []), newHarvest],
      };
    });
  }

  /* Save garden state whenever it changes */
  useEffect(() => {
    saveGardenState({ ...safeGarden, selectedPlantId });
  }, [safeGarden, selectedPlantId]);

  // Load saved note when switching cell or day
  useEffect(() => {
    if (!selectedCell) {
      setNoteDraft("");
      return;
    }

    const existing = selectedCell.entriesByGardenDay?.[selectedGardenDay] ?? "";

    setNoteDraft(existing);
  }, [selectedCellKey, selectedGardenDay, selectedCell]);

  // Keep selectedGardenDay inside the valid noteDayOptions range
  useEffect(() => {
    if (selectedGardenDay > maxNoteDay) {
      setSelectedGardenDay(maxNoteDay);
    }
    if (selectedGardenDay < 1) {
      setSelectedGardenDay(1);
    }
  }, [maxNoteDay, selectedGardenDay]);

  // How many days this plant usually takes (if we know it)
  const harvestLength = selectedPlantFromCell?.daysToHarvest ?? null;

  // Age of this plant based on your garden day timeline
  const currentPlantDay = selectedCell?.plantedOnGardenDay
    ? Math.max(0, currentGardenDay - selectedCell.plantedOnGardenDay + 1)
    : null;

  // Progress toward harvest (0–100)
  const progressPercent =
    harvestLength && currentPlantDay
      ? Math.min(100, (currentPlantDay / harvestLength) * 100)
      : null;

  let currentPlantStage = null;

  if (progressPercent !== null) {
    if (progressPercent >= 100) {
      currentPlantStage = "Harvest Ready";
    } else if (progressPercent >= 70) {
      currentPlantStage = "Flowering / Fruiting";
    } else if (progressPercent >= 30) {
      currentPlantStage = "Vegetative Growth";
    } else {
      currentPlantStage = "Seeded";
    }
  }

  if (!activeBed) return <div>Loading…</div>; //  in case the activeBedId is invalid, we show a loading state instead of crashing.
  if (!garden) return <div>Loading…</div>;

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
          <span>Columns (test)</span>
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
            onChange={(e) =>
              updateActiveBed({ rows: clampInt(e.target.value, 1, 20) })
            }
          />
        </label>

        {/* Garden Day Selector */}
        <label>
          Garden Day:
          <select
            value={selectedGardenDay}
            onChange={(e) => setSelectedGardenDay(Number(e.target.value))}
          >
            {noteDayOptions.map((day) => (
              <option key={day} value={day}>
                Day {day}
              </option>
            ))}
          </select>
        </label>

        {/* Bed Switcher */}
        <label style={{ display: "grid", gap: 6 }}>
          <span>Garden Bed</span>
          <select
            value={activeBedId}
            onChange={(e) =>
              setGarden((prev) => ({
                ...(prev ?? safeGarden),
                activeBedId: e.target.value,
              }))
            }
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
          <select
            value={selectedPlantId}
            onChange={(e) => setSelectedPlantId(e.target.value)}
          >
            {allPlantsSorted.map((plant) => (
              <option key={plant.id} value={plant.id}>
                {plant.emoji}{" "}
                {plant.variety
                  ? `${plant.type} (${plant.variety})`
                  : plant.type}
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

        {/* add bed  */}
        <button
          onClick={addBed}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
        >
          + New Bed
        </button>

        {/* delete bed  */}
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

        {/* weather  */}
        {weather && (
          <div>
            <h3>Weather</h3>
            <p>Max Temp: {weather.daily.temperature_2m_max[0]}°F</p>
            <p>
              Rain Chance: {weather.daily.precipitation_probability_max[0]}%
            </p>
            <p>
              <b>{weatherTip}</b>
            </p>
          </div>
        )}

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
          {/* Plant  */}
          <label style={{ display: "grid", gap: 6 }}>
            <span>Plant (required)</span>
            <input
              value={newPlantType}
              onChange={(e) => setNewPlantType(e.target.value)}
              placeholder="e.g., Tomato"
            />
          </label>

          {/* variety  */}
          <label style={{ display: "grid", gap: 6 }}>
            <span>Variety (optional)</span>
            <input
              value={newPlantVariety}
              onChange={(e) => setNewPlantVariety(e.target.value)}
              placeholder="e.g., Sun Gold"
            />
          </label>

          {/* days to harvest  */}
          <label style={{ display: "grid", gap: 6 }}>
            <span>Days to Harvest (optional)</span>
            <input
              type="number"
              value={newPlantDaysToHarvest}
              onChange={(e) => setNewPlantDaysToHarvest(e.target.value)}
              placeholder="e.g., 60"
            />
          </label>

          {/* emoji  */}
          <label style={{ display: "grid", gap: 6 }}>
            <span>Emoji</span>
            <input
              value={newPlantEmoji}
              onChange={(e) => setNewPlantEmoji(e.target.value)}
              maxLength={2}
            />
          </label>

          {/* image  */}
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

      <div
        style={{
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <strong>Cell Info</strong>

        {progressPercent !== null && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                height: 10,
                width: "100%",
                background: "#eee",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  background: "green",
                }}
              />
            </div>
            <div style={{ fontSize: 12 }}>
              {Math.floor(progressPercent)}% to harvest
            </div>
          </div>
        )}

        {!selectedCellKey ? (
          <div>Click a cell to see details.</div>
        ) : !selectedCell ? (
          <div>This cell is empty.</div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <div>
              <b>Plant:</b> {selectedPlantFromCell?.type}
            </div>
            <div>
              <b>Variety:</b> {selectedPlantFromCell?.variety ?? "—"}
            </div>
            <div>
              <b>Planted on Garden Day:</b>{" "}
              {selectedCell.plantedOnGardenDay ?? "—"}
            </div>

            <div>
              <b>Plant is currently Day:</b>{" "}
              {currentPlantDay !== null ? currentPlantDay : "—"}
            </div>

            <div>
              <b>Stage: </b>
              {currentPlantStage ?? "—"}

              {progressPercent !== null && (
                <div style={{ fontSize: 12 }}>
                  {progressPercent >= 100
                    ? "Ready to harvest"
                    : `${Math.floor(progressPercent)}% to harvest`}
                </div>
              )}
            </div>

            <button
              onClick={setPlantCurrentDayFromUser}
              style={{
                marginTop: 8,
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #ccc",
                cursor: "pointer",
              }}
            >
              Set Plant Day
            </button>

            {currentPlantStage === "Harvest Ready" && (
              <button
                onClick={logHarvest}
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  cursor: "pointer",
                }}
              >
                Log Harvest
              </button>
            )}

            {/* notes for the day  */}
            <div style={{ marginTop: 12 }}>
              <b>Note for Day {selectedGardenDay}</b>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={3}
                style={{ width: "100%", marginTop: 6 }}
                placeholder="e.g., watered, fertilized, pests spotted..."
              />
              <button
                onClick={saveNoteForSelectedDay}
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  cursor: "pointer",
                }}
              >
                Save Note
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        {/* The "Place Selected Plant" button is enabled when a cell is selected. When clicked, it places the currently selected plant in that cell. */}
        <button
          onClick={placeSelectedPlant}
          disabled={!selectedCellKey}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #ccc",
            cursor: !selectedCellKey ? "not-allowed" : "pointer",
            opacity: !selectedCellKey ? 0.6 : 1,
          }}
        >
          Place Selected Plant
        </button>
        {/* The "Remove Plant" button is only enabled when a cell is selected and it contains a plant. When clicked, it removes the plant from that cell. */}
        <button
          onClick={removePlantFromSelectedCell}
          disabled={!selectedCellKey || !selectedCell}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #ccc",
            cursor:
              !selectedCellKey || !selectedCell ? "not-allowed" : "pointer",
            opacity: !selectedCellKey || !selectedCell ? 0.6 : 1,
          }}
        >
          Remove Plant
        </button>
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
            const isSelected = key === selectedCellKey;

            const cell = (activeBed.placements || {})[key];
            const plantId = cell?.plantId ?? null;
            const plant = allPlantsSorted.find((p) => p.id === plantId);

            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedCellKey(key);
                }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  border: isSelected
                    ? "2px solid #000000"
                    : "1px solid #000000",
                  background: isSelected
                    ? "#9bdef3"
                    : plant
                      ? "#f4f4f4"
                      : "white",
                  transition:
                    "border-color 0.2s ease, background-color 0.2s ease",
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
          }),
        )}
      </div>
    </div>
  );
}
