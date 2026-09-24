import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none">
            {icon}
          </span>
          <input ref={ref} className={cn("input-premium pl-10", className)} {...props} />
        </div>
      );
    }
    return <input ref={ref} className={cn("input-premium", className)} {...props} />;
  }
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea ref={ref} className={cn("input-premium resize-none min-h-[80px]", className)} {...props} />
    );
  }
);
Textarea.displayName = "Textarea";
