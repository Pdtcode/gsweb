"use client";

const stepButton = "flex h-full w-10 items-center justify-center text-lg disabled:opacity-30";

export function QuantityStepper({
  quantity,
  max,
  disabled,
  onChange,
}: {
  quantity: number;
  max: number;
  disabled: boolean;
  onChange: (quantity: number) => void;
}) {
  return (
    <div
      aria-label="Quantity"
      className="flex h-10 shrink-0 items-center rounded-lg border border-gray-300 dark:border-gray-700"
      role="group"
    >
      <button
        aria-label="Decrease quantity"
        className={stepButton}
        disabled={disabled || quantity <= 1}
        type="button"
        onClick={() => onChange(quantity - 1)}
      >
        −
      </button>
      <span aria-live="polite" className="w-7 text-center font-medium tabular-nums">
        {quantity}
      </span>
      <button
        aria-label="Increase quantity"
        className={stepButton}
        disabled={disabled || quantity >= max}
        type="button"
        onClick={() => onChange(quantity + 1)}
      >
        +
      </button>
    </div>
  );
}
