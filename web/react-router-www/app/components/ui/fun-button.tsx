import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "~/lib/utils"

const funButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow hover:from-purple-600 hover:to-pink-600 hover:scale-105 active:scale-95",
        secondary: "bg-gradient-to-r from-blue-500 to-green-500 text-white shadow hover:from-blue-600 hover:to-green-600 hover:scale-105 active:scale-95",
        success: "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow hover:from-green-600 hover:to-emerald-600 hover:scale-105 active:scale-95",
        warning: "bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow hover:from-yellow-600 hover:to-orange-600 hover:scale-105 active:scale-95",
        fun: "bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 animate-pulse",
        rainbow: "bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
      },
      size: {
        sm: "h-8 px-4 text-xs",
        default: "h-10 px-6",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface FunButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof funButtonVariants> {
  asChild?: boolean
  emoji?: string
}

const FunButton = React.forwardRef<HTMLButtonElement, FunButtonProps>(
  ({ className, variant, size, emoji, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(funButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {emoji && <span className="text-lg">{emoji}</span>}
        {children}
      </Comp>
    )
  }
)
FunButton.displayName = "FunButton"

export { FunButton, funButtonVariants } 