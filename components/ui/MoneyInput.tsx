import { forwardRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface MoneyInputProps {
  value: string;
  onChange: (rawValue: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

const groupThousands = (digits: string) =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Input de monto en pesos chilenos: solo enteros, separador de miles en vivo, "$" como texto. */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [display, setDisplay] = useState(() => (value ? groupThousands(value) : ""));

    useEffect(() => {
      setDisplay(value ? groupThousands(value) : "");
    }, [value]);

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none select-none">
          $
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          className={cn("input-premium pl-7 tabular-nums", className)}
          value={display}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
            setDisplay(groupThousands(digits));
            onChange(digits);
          }}
          {...props}
        />
      </div>
    );
  }
);
MoneyInput.displayName = "MoneyInput";
