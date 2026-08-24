import { manager } from "@/lib/site-config";

export function ManagerPhoto({ className = "", size = 80 }: { className?: string; size?: number }) {
  return (
    <div className={`relative overflow-hidden rounded-full bg-amber-100 ${className}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={manager.photo}
        alt={manager.name}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
