// A small outline picture of each kind of drawing or chart, as SVG markup in a 48 x 36 box that draws in the
// current text colour. Used to choose a kind and as the picture of a board that has none of its own.
const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"';

const heat = [0, 1, 2]
  .flatMap((r) =>
    [0, 1, 2, 3].map(
      (c) => `<rect x="${8 + c * 8.5}" y="${6 + r * 8.5}" width="7.5" height="7.5" rx="1" fill="currentColor" fill-opacity="${(0.12 + ((r * 4 + c * 3) % 7) * 0.12).toFixed(2)}"/>`,
    ),
  )
  .join("");

export const VIZ_ICONS: Record<string, string> = {
  circle: `<circle cx="24" cy="18" r="12" ${F}/><path d="M24 18h12" ${S} stroke-dasharray="2 2"/>`,
  ellipse: `<ellipse cx="24" cy="18" rx="17" ry="10" ${F}/>`,
  rectangle: `<rect x="8" y="9" width="32" height="18" rx="1" ${F}/><path d="M8 31h32M44 9v18" ${S} stroke-dasharray="2 2"/>`,
  triangle: `<path d="M24 6 42 30H6Z" ${F}/>`,
  polygon: `<path d="M24 5 38 12 38 25 24 32 10 25 10 12Z" ${F}/>`,
  donut: `<circle cx="24" cy="18" r="13" ${F}/><circle cx="24" cy="18" r="5" ${S}/>`,
  annulus: `<circle cx="24" cy="18" r="13" ${S}/><circle cx="24" cy="18" r="7" ${S}/>`,
  sphere: `<circle cx="24" cy="18" r="13" ${F}/><ellipse cx="24" cy="18" rx="13" ry="4" ${S} stroke-dasharray="2 2"/>`,
  cylinder: `<path d="M11 9v18c0 3 6 5 13 5s13-2 13-5V9" ${F}/><ellipse cx="24" cy="9" rx="13" ry="4.5" ${F}/>`,
  cone: `<path d="M24 4 37 27c0 3-6 5-13 5S11 30 11 27Z" ${F}/><path d="M11 27c0 3 6 5 13 5s13-2 13-5" ${S}/>`,
  pyramid: `<path d="M24 4 41 28 24 33 7 28Z" ${F}/><path d="M24 4v29" ${S}/>`,
  box: `<path d="M8 13 20 7h20L28 13Z" ${F}/><rect x="8" y="13" width="20" height="18" ${F}/><path d="M28 13 40 7v18l-12 6" ${F}/>`,
  sweep: `<path d="M6 5v26h38" ${S}/><path d="M9 27C16 25 20 12 27 11s11 7 15 4" ${S} stroke-width="2.2"/>`,
  spread: `<path d="M6 31h38" ${S}/><path d="M8 31C14 31 17 8 24 8s10 23 16 23Z" ${F}/><path d="M24 8v23" ${S} stroke-dasharray="2 2"/>`,
  sensitivity: `<path d="M24 5v26" ${S}/><rect x="24" y="7" width="16" height="5" ${F}/><rect x="12" y="15" width="12" height="5" ${F}/><rect x="24" y="23" width="9" height="5" ${F}/>`,
  breakdown: `<rect x="5" y="12" width="38" height="12" rx="1" ${S}/><path d="M17 12v12M30 12v12" ${S}/><rect x="5" y="12" width="12" height="12" ${F}/>`,
  contributions: `<rect x="5" y="9" width="38" height="8" rx="1" ${S}/><path d="M14 9v8M26 9v8M35 9v8" ${S}/><path d="M8 24h14M8 29h24" ${S}/>`,
  gauge: `<path d="M8 28a16 16 0 0 1 32 0" ${S}/><path d="M8 28a16 16 0 0 1 10-14.8" ${S} stroke-width="4"/><path d="M24 28l7-9" ${S} stroke-width="2.2"/>`,
  bars: `<path d="M6 31h38" ${S}/><rect x="9" y="17" width="7" height="14" ${F}/><rect x="20" y="8" width="7" height="23" ${F}/><rect x="31" y="22" width="7" height="9" ${F}/>`,
  pie: `<circle cx="24" cy="18" r="13" ${S}/><path d="M24 18V5a13 13 0 0 1 12 8Z" ${F}/><path d="M24 18 36 23" ${S}/>`,
  heatmap: heat,
  dependency: `<rect x="4" y="7" width="12" height="8" rx="1" ${S}/><rect x="4" y="21" width="12" height="8" rx="1" ${S}/><rect x="32" y="14" width="12" height="8" rx="1" ${F}/><path d="M16 11l16 7M16 25l16-7" ${S}/>`,
  // A board with no drawing: a calculation sign.
  board: `<path d="M12 12h24M12 24h24" ${S} stroke-width="3"/><path d="M24 7v10M24 19v10" ${S} stroke-width="0"/>`,
};

export const vizIcon = (type: string) => VIZ_ICONS[type] ?? VIZ_ICONS.board;
