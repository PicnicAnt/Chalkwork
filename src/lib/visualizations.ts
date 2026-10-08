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
  /** The type works without it. */
  optional?: boolean;
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

// More types: shapes first, then charts.
VIZ_TYPES.splice(
  6,
  0,
  {
    id: "ellipse",
    label: "Ellipse",
    kind: "shape",
    params: [
      { key: "radius_x", label: "Half the width", short: "a" },
      { key: "radius_y", label: "Half the height", short: "b" },
    ],
  },
  { id: "sphere", label: "Sphere", kind: "shape", params: [{ key: "radius", label: "Radius", short: "r" }] },
  {
    id: "cone",
    label: "Cone",
    kind: "shape",
    params: [
      { key: "radius", label: "Radius of the base", short: "r" },
      { key: "height", label: "Height", short: "h" },
    ],
  },
  {
    id: "box",
    label: "Box",
    kind: "shape",
    params: [
      { key: "width", label: "Width", short: "w" },
      { key: "depth", label: "Depth", short: "d" },
      { key: "height", label: "Height", short: "h" },
    ],
  },
  {
    id: "polygon",
    label: "Regular polygon",
    kind: "shape",
    params: [{ key: "side", label: "Length of a side", short: "s" }],
    options: [{ key: "sides", label: "Number of sides", placeholder: "6" }],
  },
  {
    id: "annulus",
    label: "Ring (washer)",
    kind: "shape",
    params: [
      { key: "outer_radius", label: "Outer radius", short: "R" },
      { key: "inner_radius", label: "Inner radius (the hole)", short: "r" },
    ],
  },
);

VIZ_TYPES.push(
  {
    id: "gauge",
    label: "Gauge",
    kind: "chart",
    params: [{ key: "value", label: "Value", short: "v" }],
    options: [
      { key: "min", label: "Lowest value", placeholder: "0" },
      { key: "max", label: "Highest value", placeholder: "100" },
    ],
  },
  {
    id: "bars",
    label: "Bars",
    kind: "chart",
    params: [],
    lists: [{ key: "values", label: "Variables to compare", required: true }],
  },
  {
    id: "pie",
    label: "Pie chart",
    kind: "chart",
    params: [{ key: "total", label: "Total (optional: what is left is shown too)", short: "T", optional: true }],
    lists: [{ key: "parts", label: "Parts", required: true }],
  },
  {
    id: "heatmap",
    label: "Heat map",
    kind: "chart",
    params: [
      { key: "x", label: "Varied across (horizontal)", short: "x" },
      { key: "y", label: "Varied up (vertical)", short: "y" },
      { key: "z", label: "Result (the colour)", short: "z" },
    ],
    options: [
      { key: "x_from", label: "Horizontal from", placeholder: "half of now" },
      { key: "x_to", label: "Horizontal to", placeholder: "one and a half times now" },
      { key: "y_from", label: "Vertical from", placeholder: "half of now" },
      { key: "y_to", label: "Vertical to", placeholder: "one and a half times now" },
    ],
  },
  {
    id: "dependency",
    label: "Dependency diagram",
    kind: "chart",
    params: [{ key: "result", label: "Result to explain", short: "y" }],
  },
);

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
      else if (strict && !param.optional) errors.push(`The ${type.label.toLowerCase()} needs a variable for "${param.label}".`);
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

// A variable is renamed: the drawings that read it follow.
export function renameInVisualizations(vs: Visualization[], rename: (name: string) => string): Visualization[] {
  return vs.map((v) => ({
    ...v,
    map: Object.fromEntries(Object.entries(v.map).map(([param, name]) => [param, rename(name)])),
    lists: v.lists && Object.fromEntries(Object.entries(v.lists).map(([slot, names]) => [slot, names.map(rename)])),
  }));
}

// Variables are gone (a used board was removed): the drawings stop reading them.
export function dropFromVisualizations(vs: Visualization[], gone: (name: string) => boolean): Visualization[] {
  return vs.map((v) => ({
    ...v,
    map: Object.fromEntries(Object.entries(v.map).filter(([, name]) => !gone(name))),
    lists: v.lists && Object.fromEntries(Object.entries(v.lists).map(([slot, names]) => [slot, names.filter((n) => !gone(n))])),
  }));
}
