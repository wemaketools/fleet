import {
  STATUS_COLOR_VARS,
  STATUS_LABELS,
  STATUS_ON_COLOR,
  type TruckStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// Solid pill in the status's container colour.
export default function StatusPill({
  status,
  className,
}: {
  status: TruckStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-semibold whitespace-nowrap",
        className,
      )}
      style={{
        background: STATUS_COLOR_VARS[status],
        color: STATUS_ON_COLOR[status],
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
