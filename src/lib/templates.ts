import type { BoardDraft } from "./board-draft";
import { EXAMPLE } from "./example-board";

// Boards to start from. Picking one on the New page opens the editor with it filled in; the new board is a
// copy that belongs to whoever saves it.
export type Template = { id: string; title: string; blurb: string; draft: BoardDraft };

const none = { descriptions: {}, units: {}, hidden: {}, labels: {}, decimals: {}, ranges: {}, tables: [], order: [], tags: [], includes: [], links: {}, visualizations: [] };

export const BLANK_ID = "blank";

export const TEMPLATES: Template[] = [
  {
    id: "loan",
    title: "Loan payment",
    blurb: "Monthly payment, total paid and interest. Type a payment you can afford and see how much you can borrow.",
    draft: {
      ...none,
      title: "Loan payment",
      description: "What a loan costs: change the amount, the rate, the term or the payment, and the rest follows.",
      formulas: [
        "monthly_rate = annual_rate / 12 / 100",
        "payment = principal * monthly_rate / (1 - (1 + monthly_rate) ^ -months)",
        "total_paid = payment * months",
        "interest = total_paid - principal",
      ],
      values: { principal: "200000", annual_rate: "4.5", months: "360" },
      labels: { principal: "Amount borrowed", annual_rate: "Yearly interest", months: "Number of months", payment: "Monthly payment", total_paid: "Total paid", interest: "Interest paid" },
      units: { annual_rate: "%", months: "months" },
      decimals: { payment: 2, total_paid: 0, interest: 0, monthly_rate: 5 },
      hidden: { monthly_rate: true },
      visualizations: [{ type: "breakdown", map: { total: "total_paid" }, lists: { parts: ["principal", "interest"] } }],
    },
  },
  {
    id: "savings",
    title: "Savings growth",
    blurb: "What a sum grows to with interest over the years, with a chart of the years.",
    draft: {
      ...none,
      title: "Savings growth",
      description: "Compound interest: change any of the numbers, including the result, to see what it takes.",
      formulas: ["future = start * (1 + rate / 100) ^ years", "gain = future - start"],
      values: { start: "10000", rate: "5", years: "20" },
      labels: { start: "Start amount", rate: "Yearly interest", years: "Years", future: "After the years", gain: "Gain" },
      units: { rate: "%", years: "years" },
      decimals: { future: 0, gain: 0 },
      visualizations: [{ type: "sweep", map: { x: "years", y: "future" }, options: { from: 0, to: 40 } }],
    },
  },
  {
    id: "rectangle",
    title: "Rectangle",
    blurb: "Area, perimeter and diagonal, with a drawing that follows the sides.",
    draft: {
      ...none,
      title: "Rectangle",
      description: "A rectangle. Change a side, or the area, and the drawing follows.",
      formulas: ["area = width * height", "perimeter = 2 * (width + height)", "diagonal = sqrt(width ^ 2 + height ^ 2)"],
      values: { width: "12", height: "8" },
      units: { width: "m", height: "m", area: "m²", perimeter: "m", diagonal: "m" },
      decimals: { area: 2, perimeter: 2, diagonal: 2 },
      visualizations: [{ type: "rectangle", map: { width: "width", height: "height" } }],
    },
  },
  {
    id: "tax",
    title: "Tax by income tier",
    blurb: "A tax rate looked up in a table of income tiers, with a condition for the deduction. Type the net pay you want to see what income it takes.",
    draft: {
      ...none,
      title: "Tax by income tier",
      description: "The rate depends on which tier the taxable income falls in (a table), and the deduction depends on a condition. Both work backwards too.",
      formulas: [
        "deduction = if(income > 40000, 2000, 1000)",
        "taxable = income - deduction",
        "rate = tax_rate(taxable)",
        "tax = taxable * rate / 100",
        "net = income - tax",
      ],
      values: { income: "45000" },
      labels: { income: "Income", deduction: "Deduction", taxable: "Taxable income", rate: "Tax rate", tax: "Tax", net: "Take-home pay" },
      units: { rate: "%" },
      decimals: { tax: 0, net: 0, taxable: 0 },
      tables: [{ name: "tax_rate", mode: "step", rows: [[0, 10], [20000, 20], [50000, 30]] }],
    },
  },
  {
    id: "damage",
    title: "Damage per second",
    blurb: "A role-playing game damage sheet with crit, attack speed and hit chance, and charts of what matters most.",
    draft: {
      ...none,
      title: EXAMPLE.title,
      description: EXAMPLE.description,
      formulas: EXAMPLE.formulas.split("\n"),
      values: EXAMPLE.values,
      descriptions: EXAMPLE.descriptions,
      units: EXAMPLE.units,
      labels: EXAMPLE.labels,
      decimals: Object.fromEntries(Object.entries(EXAMPLE.decimals).map(([k, v]) => [k, Number(v)])),
      ranges: { accuracy: { min: 1500, max: 3500 }, inc_dmg: { min: 150, max: 350 }, more_dmg: { min: 30, max: 70 } },
      visualizations: [
        { type: "sensitivity", map: { y: "dps" } },
        { type: "spread", map: { y: "dps" } },
        { type: "sweep", map: { x: "accuracy", y: "dps" }, options: { from: 500, to: 8000 } },
      ],
    },
  },
];

export const templateById = (id: string): Template | undefined => TEMPLATES.find((t) => t.id === id);
