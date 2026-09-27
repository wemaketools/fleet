import { cn } from "@/lib/utils";

export interface KeyValueItem {
  label: string;
  value: React.ReactNode;
  title?: string;
}

export default function KeyValue({
  items,
  className,
}: {
  items: KeyValueItem[];
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-xl bg-tint px-3 py-2">
          <dt className="text-[12px] text-ink-3">{item.label}</dt>
          <dd
            title={item.title}
            className="text-[14px] font-medium text-ink truncate"
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
