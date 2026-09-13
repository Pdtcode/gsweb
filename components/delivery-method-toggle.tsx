"use client";

// "inperson" is an in-person sale: the customer is standing with us and pays
// by card on the spot, taking their items away immediately. It needs neither a
// shipping address nor a pickup location, and it lives under the Pick Up tab.
export type DeliveryMethod = "shipping" | "pickup" | "inperson";

interface DeliveryMethodToggleProps {
  value: DeliveryMethod;
  onChange: (method: DeliveryMethod) => void;
}

export function DeliveryMethodToggle({ value, onChange }: DeliveryMethodToggleProps) {
  // Both pickup modes live behind the same tab
  const isPickupTab = value === "pickup" || value === "inperson";

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange("shipping")}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
          value === "shipping"
            ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-black"
            : "bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
        }`}
      >
        Ship
      </button>
      <button
        type="button"
        onClick={() => onChange("pickup")}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
          isPickupTab
            ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-black"
            : "bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
        }`}
      >
        Pick Up
      </button>
    </div>
  );
}
