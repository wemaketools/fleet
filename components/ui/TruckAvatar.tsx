import {
  SIDE_VIEW_HEIGHT,
  SIDE_VIEW_WIDTH,
  truckSideSvgMarkup,
} from "@/components/map/vehicleGlyphs";
import {
  STATUS_COLORS,
  STATUS_COLOR_VARS,
  VEHICLE_TYPE_LABELS,
  type TruckStatus,
  type VehicleType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// Side-view illustration of the truck type, painted in its status colour,
// on a soft tile of the same colour.
export default function TruckAvatar({
  vehicleType,
  status,
  size = 48,
  className,
}: {
  vehicleType: VehicleType;
  status: TruckStatus;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-xl",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${STATUS_COLOR_VARS[status]} 14%, white)`,
      }}
      title={VEHICLE_TYPE_LABELS[vehicleType]}
    >
      <svg
        aria-hidden
        viewBox={`0 0 ${SIDE_VIEW_WIDTH} ${SIDE_VIEW_HEIGHT}`}
        width={size * 0.86}
        height={(size * 0.86 * SIDE_VIEW_HEIGHT) / SIDE_VIEW_WIDTH}
        className={cn(status === "offline" && "opacity-60")}
        dangerouslySetInnerHTML={{
          __html: truckSideSvgMarkup(vehicleType, STATUS_COLORS[status]),
        }}
      />
      {status === "offline" && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-status-offline ring-2 ring-white text-white text-[10px] font-bold leading-4 text-center"
        >
          !
        </span>
      )}
    </span>
  );
}
