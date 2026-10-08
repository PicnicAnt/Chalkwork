// Visualizations: a drawing or chart that follows a board's variables.
//
// A board can have any number of visualizations. Each one picks a *type* and fills in what the type
// needs, in three kinds of slots:
//   - parameters: one variable each (a rectangle's width, a chart's vertical axis),
//   - lists: several variables (the parts of a breakdown),
//   - options: plain numbers (the range of a chart).
// Nothing here is specific to one board, so any board whose variables fit a type can use it, and a
// board that uses other boards also shows the drawings those boards have, for the variables they
// brought along.
//
// Shapes (circle, rectangle, ...) only read the current values. Charts (sweep, sensitivity,
// breakdown) also re-solve the board with other values, which is what makes them fit equations well.
//
// This file only describes the types and checks what was saved (plain logic, usable on the server
// and in the browser). The drawings are in components/Visualization.tsx and components/Charts.tsx. A
// new type is a new entry in VIZ_TYPES here and a drawing there.

export type Visualization = {
  /** Which drawing: an id from VIZ_TYPES. */
  type: string;
  /** For each parameter of the type, the variable it takes its value from (in this board's namespace). */
  map: Record<string, string>;
  /** For each list of the type, the variables in it. */
  lists?: Record<string, string[]>;
  /** For each option of the type, its number. Left out when not set (the type has a default). */
  options?: Record<string, number>;
};

/** A visualization inside a flattened board: those of used boards say which board they belong to. */
export type BundleVisualization = Visualization & { group?: string };

export type VizParam = {
  key: string;
  /** What the editor asks for. */
  label: string;
  /** A short name for the drawing, such as r or w. */
  short: string;
};

export type VizList = { key: string; label: string; /** At least one variable is needed. */ required?: boolean };
export type VizOption = { key: string; label: string; placeholder: string };

export type VizType = {
  id: string;
  label: string;
  /** A shape needs only the current values; a chart re-solves the board with other values. */
  kind: "shape" | "chart";
  params: VizParam[];
  lists?: VizList[];
  options?: VizOption[];
};

export const VIZ_TYPES: VizType[] = [
  { id: "circle", label: "Circle", kind: "shape", params: [{ key: "radius", label: "Radius", short: "r" }] },
  {
    id: "rectangle",
    label: "Rectangle",
    kind: "shape",
    params: [
      { key: "width", label: "Width", short: "w" },
      { key: "height", label: "Height", short: "h" },
    ],
  },
  {
    id: "triangle",
    label: "Triangle",
    kind: "shape",
    params: [
      { key: "base", label: "Base", short: "b" },
      { key: "height", label: "Height", short: "h" },
    ],
  },
  {
    id: "cylinder",
    label: "Cylinder",
    kind: "shape",
    params: [
      { key: "radius", label: "Radius", short: "r" },
      { key: "height", label: "Height", short: "h" },
    ],
  },
  {
    id: "pyramid",
    label: "Pyramid",
    kind: "shape",
    params: [
      { key: "width", label: "Width of the base", short: "w" },
      { key: "depth", label: "Depth of the base", short: "d" },
      { key: "height", label: "Height", short: "h" },
    ],
  },
  {
    id: "donut",
    label: "Donut",
    kind: "shape",
    params: [
      { key: "ring_radius", label: "Ring radius (to the middle of the dough)", short: "R" },
      { key: "tube_radius", label: "Dough radius", short: "r" },
    ],
  },
  {
    id: "sweep",
    label: "Sweep chart",
    kind: "chart",
    params: [
      { key: "x", label: "Varied (horizontal axis)", short: "x" },
      { key: "y", label: "Result (vertical axis)", short: "y" },
    ],
    options: [
      { key: "from", label: "From", placeholder: "half of now" },
      { key: "to", label: "To", placeholder: "one and a half times now" },
    ],
  },
  {
    id: "sensitivity",
    label: "Sensitivity bars",
    kind: "chart",
    params: [{ key: "y", label: "Result", short: "y" }],
    lists: [{ key: "inputs", label: "Inputs to vary (none chosen: all the numbers you have typed)" }],
    options: [{ key: "percent", label: "Change in percent", placeholder: "10" }],
  },
  {
    id: "breakdown",
    label: "Breakdown bar",
    kind: "chart",
    params: [{ key: "total", label: "Total", short: "T" }],
    lists: [{ key: "parts", label: "Parts of the total", required: true }],
  },
];

export const vizType = (id: string): VizType | undefined => VIZ_TYPES.find((t) => t.id === id);

export const MAX_VISUALIZATIONS = 8;
const MAX_LIST = 12;

// Reads the visualizations a board was saved with, or sent by the editor. Anything that isn't a known
// type is dropped. `known` are the variables that exist; with `strict`, a parameter or list that is
// missing or points at a variable that doesn't exist is reported.
export function parseVisualizations(
  raw: unknown,
  known: ReadonlySet<string>,
  strict = false,
): { visualizations: Visualization[]; errors: string[] } {
  const errors: string[] = [];
  const visualizations: Visualization[] = [];
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > MAX_VISUALIZATIONS) errors.push(`At most ${MAX_VISUALIZATIONS} drawings.`);
  for (const item of list.slice(0, MAX_VISUALIZATIONS)) {
    const type = typeof item?.type === "string" ? vizType(item.type) : undefined;
    if (!type) continue;

    const rawMap = typeof item.map === "object" && item.map !== null ? (item.map as Record<string, unknown>) : {};
    const map: Record<string, string> = {};
    for (const param of type.params) {
      const variable = rawMap[param.key];
      if (typeof variable === "string" && known.has(variable)) map[param.key] = variable;
      else if (strict) errors.push(`The ${type.label.toLowerCase()} needs a variable for "${param.label}".`);
    }

    const viz: Visualization = { type: type.id, map };

    const rawLists = typeof item.lists === "object" && item.lists !== null ? (item.lists as Record<string, unknown>) : {};
    const lists: Record<string, string[]> = {};
    for (const slot of type.lists ?? []) {
      const given = Array.isArray(rawLists[slot.key]) ? (rawLists[slot.key] as unknown[]) : [];
      const names = [...new Set(given.filter((n): n is string => typeof n === "string" && known.has(n)))].slice(0, MAX_LIST);
      if (names.length > 0) lists[slot.key] = names;
      else if (strict && slot.required) errors.push(`The ${type.label.toLowerCase()} needs at least one variable under "${slot.label}".`);
    }
    if (Object.keys(lists).length > 0) viz.lists = lists;

    const rawOptions = typeof item.options === "object" && item.options !== null ? (item.options as Record<string, unknown>) : {};
    const options: Record<string, number> = {};
    for (const slot of type.options ?? []) {
      const n = rawOptions[slot.key];
      if (typeof n === "number" && Number.isFinite(n)) options[slot.key] = n;
    }
    if (Object.keys(options).length > 0) viz.options = options;

    visualizations.push(viz);
  }
  return { visualizations, errors };
}
