import { cn } from "@/lib/utils";

export default function SectionHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("mb-2.5 text-[13px] font-semibold text-ink-2", className)}>
      {children}
    </h3>
  );
}
