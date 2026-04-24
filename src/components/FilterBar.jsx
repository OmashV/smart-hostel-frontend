import React from "react";

export default function FilterBar({
  floorId = "all",
  setFloorId,
  roomId,
  setRoomId,
  forecastDays,
  setForecastDays,
  availableFloors = [],
  availableRooms = []
}) {
  const showFloorFilter = typeof setFloorId === "function";
  const showForecastDays = typeof setForecastDays === "function" && roomId !== "all";

  return (
    <div className="filter-bar">
      {showFloorFilter && (
        <label>
          Floor
          <select value={floorId} onChange={(e) => setFloorId(e.target.value)}>
            <option value="all">All Floors</option>
            {availableFloors.map((floor) => (
              <option key={floor} value={floor}>
                {floor}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Room
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="all">All Rooms</option>
          {availableRooms.map((room) => (
            <option key={room} value={room}>
              {room}
            </option>
          ))}
        </select>
      </label>

      {showForecastDays && (
        <label>
          Forecast days
          <select
            value={forecastDays}
            onChange={(e) => setForecastDays(Number(e.target.value))}
          >
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={7}>7</option>
          </select>
        </label>
      )}
    </div>
  );
}
