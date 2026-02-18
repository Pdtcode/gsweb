"use client";

export interface PickupLocation {
  _id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
}

interface PickupLocationSelectorProps {
  locations: PickupLocation[];
  selectedId: string;
  onSelect: (id: string) => void;
  isLoading: boolean;
}

export function PickupLocationSelector({
  locations,
  selectedId,
  onSelect,
  isLoading,
}: PickupLocationSelectorProps) {
  return (
    <div>
      <label
        htmlFor="pickupLocation"
        className="block text-sm font-medium mb-2"
      >
        Pickup Location
      </label>
      <select
        id="pickupLocation"
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        disabled={isLoading}
      >
        {isLoading ? (
          <option value="" disabled>
            Loading locations...
          </option>
        ) : locations.length === 0 ? (
          <>
            <option value="">Select a pickup location...</option>
            <option value="" disabled>
              No pickup locations available
            </option>
          </>
        ) : (
          <>
            <option value="">Select a pickup location...</option>
            {locations.map((location) => (
              <option key={location._id} value={location._id}>
                {location.name} — {location.address.street}, {location.address.city},{" "}
                {location.address.state} {location.address.zip}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
