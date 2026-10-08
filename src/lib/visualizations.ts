// Visualizations: a drawing that follows a board's variables.
//
// A board can have any number of visualizations. Each one picks a drawing *type* and maps the
// type's parameters to variables of the board: a "rectangle" has the parameters width and height,
// and the board says which of its variables those are. Nothing here is specific to one board, so
// any board whose variables fit a type can use it, and a board that uses other boards also shows
// the drawings those boards have, for the variables they brought along.
//
// This file only describes the types and checks what was saved (plain logic, usable on the server
// and in the browser). The drawings themselves are in components/Visualization.tsx. A new type is a
// new entry in VIZ_TYPES here and a new drawing there: the parameters are what a type needs, in the
// same way for shapes today and, later, for diagrams.

export type Visualization = {
  /** Which drawing: an id from VIZ_TYPES. */
  type: string;
  /** For each parameter of the type, the variable it takes its value from (in this board's namespace). */
  map: Record<string, string>;
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

export type VizType = { id: string; label: string; params: VizParam[] };

export const VIZ_TYPES: VizType[] = [
  { id: "circle", label: "Circle", params: [{ key: "radius", label: "Radius", short: "r" }] },
  {
    id: "rectangle",
    label: "Rectangle",
    params: [
      { key: "width", label: "Width", short: "w" },
      { key: "height", label: "Height", short: "h" },
    ],
  },
  {
    id: "triangle",
    label: "Triangle",
    params: [
      { key: "base", label: "Base", short: "b" },
      { key: "height", label: "Height", short: "h" },
    ],
  },
  {
    id: "cylinder",
    label: "Cylinder",
    params: [
      { key: "radius", label: "Radius", short: "r" },
      { key: "height", label: "Height", short: "h" },
    ],
  },
  {
    id: "pyramid",
    label: "Pyramid",
    params: [
      { key: "width", label: "Width of the base", short: "w" },
      { key: "depth", label: "Depth of the base", short: "d" },
      { key: "height", label: "Height", short: "h" },
    ],
  },
  {
    id: "donut",
    label: "Donut",
    params: [
      { key: "ring_radius", label: "Ring radius (to the middle of the dough)", short: "R" },
      { key: "tube_radius", label: "Dough radius", short: "r" },
    ],
  },
];

export const vizType = (id: string): VizType | undefined => VIZ_TYPES.find((t) => t.id === id);

export const MAX_VISUALIZATIONS = 6;

// Reads the visualizations a board was saved with, or sent by the editor. Anything that isn't a known
// type is dropped. `known` are the variables that exist; with `strict`, a parameter that is missing or
// points at a variable that doesn't exist is reported.
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
      else if (strict) errors.push(`The ${type.label.toLowerCase()} drawing needs a variable for "${param.label}".`);
    }
    visualizations.push({ type: type.id, map });
  }
  return { visualizations, errors };
}
