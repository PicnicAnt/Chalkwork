// What a drawing or chart can ask the board it is on. Shapes only need `number` and `text`; the
// charts also re-solve the board with other values (`evaluate`).
export type VizValues = {
  /** The number a variable currently has, or undefined if it has none yet. */
  number: (name: string) => number | undefined;
  /** How to write it, with decimals and unit, as shown on the board. */
  text: (name: string) => string;
  /** What the board calls the variable (its display name, or its name). */
  name: (name: string) => string;
  /** The name with the board it comes from in front, when it comes from a used board (for lists of several). */
  fullName: (name: string) => string;
  /** Its unit, or an empty string. */
  unit: (name: string) => string;
  /** True when the variable is locked (kept at the value typed). */
  isLocked: (name: string) => boolean;
  /** The variables the user has typed values for, which are the board's inputs. */
  inputs: () => string[];
  /**
   * Solves the board again with these variables held at the given numbers (everything else keeps its
   * lock) and returns every variable's number, or null if that can't be solved.
   */
  evaluate: (overrides: Record<string, number>) => Record<string, number> | null;
  /** Moves the focus to the variable's field on the board, scrolling it into view. Does nothing if it isn't shown. */
  focus: (name: string) => void;
  /** The board's equations: what each variable is worked out from. */
  formulas: () => { name: string; vars: string[] }[];
  /** Changes whenever anything a chart depends on changes, so a chart can compute only then. */
  signature: string;
};
