import { cn } from "@/lib/utils";

// Number plate chip: white plate, bold dark lettering, easy to read at a
// glance and to match against the real vehicle.
export default function PlateBadge({
  plate,
  size = "md",
  className,
}: {
  plate: string;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-label={`Plate ${plate}`}
      className={cn(
        "inline-flex items-center shrink-0 rounded-md bg-white border-[1.5px] border-ink/70 font-bold tracking-[0.04em] text-ink whitespace-nowrap",
        size === "md" && "h-6 px-2 text-[12.5px]",
        size === "lg" && "h-8 px-2.5 text-[15px]",
        className,
      )}
    >
      {plate}
    </span>
  );
}
