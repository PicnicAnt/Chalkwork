import { tokenize } from "@/lib/formulas";

// A formula as text, coloured the way it is in the editor: variables, functions and constants, numbers and
// operators each have their own colour. For showing a formula that can't be edited.
export function FormulaText({ text }: { text: string }) {
  return (
    <>
      {tokenize(text).map((t, i) => (
        <span key={i} className={`tok-${t.kind}`}>
          {t.text}
        </span>
      ))}
    </>
  );
}
