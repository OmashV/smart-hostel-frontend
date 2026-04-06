export default function FilterBar({
  roomId,
  setRoomId,
  forecastDays,
  setForecastDays
}) {
  return (
    <div className="filter-bar">
      <label>
        Room
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="all">All Rooms</option>
          <option value="A101">A101</option>
          <option value="A102">A102</option>
          <option value="A103">A103</option>
          <option value="A201">A201</option>
          <option value="A202">A202</option>
          <option value="A203">A203</option>
        </select>
      </label>

      {setForecastDays && roomId !== "all" && (
        <label>
          Forecast days
          <select
            value={forecastDays}
            onChange={(e) => setForecastDays(Number(e.target.value))}
          >
            <option value={5}>5</option>
            <option value={7}>7</option>
          </select>
        </label>
      )}
    </div>
  );
}