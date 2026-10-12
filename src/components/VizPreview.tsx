import { vizIcon } from "@/lib/viz-icons";

// A small picture of what each kind of drawing or chart looks like, for choosing one.
export function VizPreview({ type, className = "" }: { type: string; className?: string }) {
  return <svg viewBox="0 0 48 36" className={className} role="img" aria-hidden dangerouslySetInnerHTML={{ __html: vizIcon(type) }} />;
}
