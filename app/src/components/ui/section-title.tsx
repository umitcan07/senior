import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const sectionTitleVariants = cva(
  "flex flex-col gap-2",
  {
    variants: {
      variant: {
        default: "border-l-2 border-primary/20 pl-4",
        playful: "items-start",
        accent: "items-start",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface SectionTitleProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sectionTitleVariants> {
  title: string;
  description?: string;
}

export function SectionTitle({
  title,
  description,
  variant,
  className,
  ...props
}: SectionTitleProps) {
  return (
    <div
      className={cn(sectionTitleVariants({ variant }), className)}
      {...props}
    >
      {variant === "playful" ? (
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {title}
            </span>
          </h2>
          {description && (
            <p className="text-muted-foreground text-xs">{description}</p>
          )}
        </div>
      ) : variant === "accent" ? (
        <div className="flex flex-col gap-1">
          <h2 className="relative inline-block text-xl font-semibold tracking-tight">
            {title}
            <span className="absolute -bottom-1 left-0 h-0.5 w-1/4 rounded-full bg-primary/30" />
          </h2>
          {description && (
            <p className="text-muted-foreground text-xs">{description}</p>
          )}
        </div>
      ) : (
        <>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </>
      )}
    </div>
  );
}

