import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8", 
  lg: "h-12 w-12",
  xl: "h-16 w-16"
};

export function Logo({ className, size = "md", showText = false }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img 
        src="/sanbitu-logo.svg" 
        alt="Sanbitu FC Logo" 
        className={cn("object-contain", sizeClasses[size])}
      />
      {showText && (
        <div>
          <h1 className="font-display text-lg font-bold text-foreground">
            Sanbitu FC
          </h1>
          <p className="text-xs text-muted-foreground">Est. 2014</p>
        </div>
      )}
    </div>
  );
}