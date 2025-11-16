import { CheckCircle2, Star, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumBadgeProps {
  verified?: boolean;
  star?: boolean;
  custom?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function PremiumBadge({ verified, star, custom, size = "md", className }: PremiumBadgeProps) {
  const badges: JSX.Element[] = [];

  // Priority 1: Verified Badge (Top Premium - Blue Checkmark)
  if (verified) {
    const sizeClasses = {
      sm: "w-3.5 h-3.5",
      md: "w-4 h-4",
      lg: "w-5 h-5"
    };
    badges.push(
      <div
        key="verified"
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700",
          "shadow-lg shadow-blue-500/50 border-2 border-blue-400/80",
          "hover:scale-110 transition-transform",
          sizeClasses[size],
          className
        )}
        title="Verified Member - Core Team"
      >
        <CheckCircle2 className={cn("text-white", sizeClasses[size])} strokeWidth={2.5} />
      </div>
    );
  }

  // Priority 2: Star Badge (Second Premium - Gold Star)
  if (star) {
    const sizeClasses = {
      sm: "w-3.5 h-3.5",
      md: "w-4 h-4",
      lg: "w-5 h-5"
    };
    badges.push(
      <div
        key="star"
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600",
          "shadow-lg shadow-amber-500/50 border-2 border-amber-300/80",
          "hover:scale-110 transition-transform",
          sizeClasses[size],
          className
        )}
        title="Star Member - Special Contributor"
      >
        <Star className={cn("text-white fill-white", sizeClasses[size])} strokeWidth={2.5} />
      </div>
    );
  }

  // Custom badge (future GPT Pro support)
  if (custom) {
    badges.push(
      <div
        key="custom"
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600",
          "shadow-lg shadow-purple-500/50 border-2 border-purple-300/80",
          "px-1.5 py-0.5 text-[10px] font-bold text-white uppercase",
          className
        )}
        title={`Custom Badge: ${custom}`}
      >
        {custom}
      </div>
    );
  }

  if (badges.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-1">
      {badges}
    </div>
  );
}

