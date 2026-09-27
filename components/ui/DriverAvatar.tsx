import Image from "next/image";
import { initials } from "@/lib/format";
import type { Driver } from "@/lib/types";
import { cn } from "@/lib/utils";

// Round driver photo, falling back to initials when there is no photo.
export default function DriverAvatar({
  driver,
  size = 40,
  className,
}: {
  driver: Driver;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-tint-2 ring-2 ring-white text-ink font-semibold",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {driver.photoUrl ? (
        // Unoptimized: Unsplash asks apps to hotlink its image URLs directly.
        <Image
          src={driver.photoUrl}
          alt={`Photo of ${driver.name}`}
          width={size * 2}
          height={size * 2}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        initials(driver.name)
      )}
    </span>
  );
}
