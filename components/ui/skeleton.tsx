import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-gradient-to-r from-muted via-muted-foreground/5 to-muted animate-shimmer",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
