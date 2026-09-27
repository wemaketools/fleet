import {
  PackageMinus,
  PackagePlus,
  SquareParking,
  Truck,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { TruckStatus } from "@/lib/types";

// One recognisable icon per status, so status never relies on colour alone.
export const STATUS_ICONS: Record<TruckStatus, LucideIcon> = {
  in_transit: Truck,
  loading: PackagePlus,
  unloading: PackageMinus,
  idle: SquareParking,
  offline: WifiOff,
};

export default function StatusIcon({
  status,
  className,
  style,
}: {
  status: TruckStatus;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = STATUS_ICONS[status];
  return (
    <Icon aria-hidden className={className} style={style} strokeWidth={2.25} />
  );
}
