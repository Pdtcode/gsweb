"use client";

export type PickupMode = "pickup" | "inperson";

interface PickupModeSelectorProps {
  value: PickupMode;
  onChange: (mode: PickupMode) => void;
}

const OPTIONS: {
  value: PickupMode;
  label: string;
  description: string;
}[] = [
  {
    value: "pickup",
    label: "Collect later",
    description: "Pick your order up from one of our locations.",
  },
  {
    value: "inperson",
    label: "In Person",
    description:
      "You're with us and taking your items today. No address or pickup location needed.",
  },
];

/**
 * Chooses between the two fulfilment modes that live under the Pick Up tab.
 *
 * "inperson" exists for sales made face to face — the customer pays by card on
 * the spot and walks away with the goods, so there is nothing to ship and
 * nowhere to collect from later.
 */
export function PickupModeSelector({ value, onChange }: PickupModeSelectorProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="block text-sm font-medium mb-2">
        How are you getting your order?
      </legend>

      {OPTIONS.map((option) => {
        const selected = value === option.value;

        return (
          <div
            key={option.value}
            className={`flex items-start gap-3 rounded-lg border p-3 transition ${
              selected
                ? "border-gray-900 dark:border-gray-100 bg-gray-50 dark:bg-gray-900"
                : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
            }`}
          >
            <input
              checked={selected}
              className="mt-1"
              id={`pickupMode-${option.value}`}
              name="pickupMode"
              type="radio"
              value={option.value}
              onChange={() => onChange(option.value)}
            />
            <label
              className="cursor-pointer"
              htmlFor={`pickupMode-${option.value}`}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                {option.description}
              </span>
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
