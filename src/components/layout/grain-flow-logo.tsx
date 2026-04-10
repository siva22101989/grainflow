import Image from "next/image"
import { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function GrainFlowLogo({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("relative aspect-square", className)} {...props}>
      <Image 
        src="/logo-v4.png" 
        alt="GrainFlow Logo" 
        fill
        className="object-contain"
        priority
      />
    </div>
  )
}
