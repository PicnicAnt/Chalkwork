import { vizType, type Visualization } from "@/lib/visualizations";
import { BarsChart, BreakdownBar, DependencyDiagram, GaugeChart, HeatMap, PieChart, SensitivityBars, SweepChart } from "./charts";
import { annulus, circle, donut, ellipse, polygon, rectangle, triangle } from "./shapes/flat";
import { box, cone, cylinder, pyramid, sphere } from "./shapes/solid";
import { H, W, type Drawn } from "./shapes/common";
import type { VizValues } from "./viz-values";

// A drawing or chart on a board, from the values the board has right now. It follows them as they change.
// Shapes only read the numbers; charts solve the board again with other values (see ./charts).

const DRAWINGS: Record<string, (v: Record<string, number>, t: (param: string) => string, o: Record<string, number>) => Drawn> = {
  circle,
  rectangle,
  triangle,
  cylinder,
  pyramid,
  donut,
  ellipse,
  sphere,
  cone,
  box,
  polygon,
  annulus,
};

// One drawing, from the values the board has right now. It follows them as they change.
export function VisualizationView({ viz, values }: { viz: Visualization; values: VizValues }) {
  const type = vizType(viz.type);
  if (!type) return null;
  if (type.kind === "chart") {
    if (viz.type === "sweep") return <SweepChart viz={viz} values={values} />;
    if (viz.type === "sensitivity") return <SensitivityBars viz={viz} values={values} />;
    if (viz.type === "breakdown") return <BreakdownBar viz={viz} values={values} />;
    if (viz.type === "gauge") return <GaugeChart viz={viz} values={values} />;
    if (viz.type === "bars") return <BarsChart viz={viz} values={values} />;
    if (viz.type === "pie") return <PieChart viz={viz} values={values} />;
    if (viz.type === "heatmap") return <HeatMap viz={viz} values={values} />;
    if (viz.type === "dependency") return <DependencyDiagram viz={viz} values={values} />;
    return null;
  }
  const draw = DRAWINGS[viz.type];
  if (!draw) return null;

  const numbers: Record<string, number> = {};
  for (const param of type.params) {
    const variable = viz.map[param.key];
    const n = variable ? values.number(variable) : undefined;
    if (n === undefined || !(n > 0)) {
      return (
        <p className="text-base text-ink-muted">
          The {type.label.toLowerCase()} is drawn once {param.label.toLowerCase()} has a value above zero.
        </p>
      );
    }
    numbers[param.key] = n;
  }
  const { svg, summary } = draw(numbers, (param) => (viz.map[param] ? values.text(viz.map[param]) : ""), viz.options ?? {});
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Drawing: ${summary}`} className="mx-auto block w-full max-w-sm">
      {svg}
    </svg>
  );
}
