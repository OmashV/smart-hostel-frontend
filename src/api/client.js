import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
});

export async function getAvailableFloors() {
  const { data } = await api.get("/rooms/available-floors");
  return data;
}

export async function getAvailableRooms(floorId) {
  const { data } = await api.get("/rooms/available-rooms", {
    params: floorId && floorId !== "all" ? { floorId } : {}
  });
  return data;
}

export async function getFloorOverview() {
  const { data } = await api.get("/rooms/floors/overview");
  return data;
}

export async function getOwnerKpis(roomId = "A101") {
  const { data } = await api.get(`/rooms/${roomId}/owner-kpis`);
  return data;
}

export async function getOwnerRoomsOverview(floorId) {
  const { data } = await api.get("/rooms/owner/rooms-overview", {
    params: floorId && floorId !== "all" ? { floorId } : {}
  });
  return data;
}

export async function getOwnerRoomComparison() {
  const { data } = await api.get(`/rooms/owner/room-comparison`);
  return data;
}

export async function getOwnerWeekdayPatterns(roomId) {
  const { data } = await api.get("/rooms/owner/weekday-patterns", {
    params: roomId ? { roomId } : {}
  });
  return data;
}

export async function getOwnerAlerts(roomId) {
  const { data } = await api.get("/rooms/owner/alerts", {
    params: roomId ? { roomId } : {}
  });
  return data;
}

export async function resolveOwnerAlert(alertId) {
  const { data } = await api.patch(`/rooms/owner/alerts/${alertId}/resolve`);
  return data;
}

export async function deleteOwnerAlert(alertId) {
  const { data } = await api.delete(`/rooms/owner/alerts/${alertId}`);
  return data;
}


export async function getOwnerAnomalies(roomId) {
  const { data } = await api.get("/rooms/owner/anomalies", {
    params: roomId ? { roomId } : {}
  });
  return data;
}

export async function getOwnerFeatureImportance() {
  const { data } = await api.get(`/rooms/owner/feature-importance`);
  return data;
}



export async function getOwnerPatterns() {
  const { data } = await api.get(`/rooms/owner/patterns`);
  return data;
}

export async function getOwnerForecasts() {
  const { data } = await api.get(`/rooms/owner/forecasts`);
  return data;
}

export async function getEnergyHistory(roomId = "A101") {
  const { data } = await api.get(`/rooms/${roomId}/energy/history`);
  return data;
}

export async function getEnergyForecast(roomId = "A101", days = 5) {
  const { data } = await api.get(`/rooms/${roomId}/energy/forecast?days=${days}`);
  return data;
}

export async function getTopWasteDays(roomId = "A101", limit = 5) {
  const { data } = await api.get(`/rooms/${roomId}/energy/top-waste-days?limit=${limit}`);
  return data;
}
export async function getWardenSummary() {
  const { data } = await api.get(`/rooms/warden/summary`);
  return data;
}

export async function getWardenRoomsStatus() {
  const { data } = await api.get(`/rooms/warden/rooms-status`);
  return data;
}

export async function getWardenNoiseIssues() {
  const { data } = await api.get(`/rooms/warden/noise-issues`);
  return data;
}

export async function getWardenInspectionQueue() {
  const { data } = await api.get(`/rooms/warden/inspection-queue`);
  return data;
}

export async function getWardenNoiseTrend(days = 7) {
  const { data } = await api.get(`/rooms/warden/noise-trend?days=${days}`);
  return data;
}
export async function getWardenHistory(days = 7, roomId = "All") {
  const query =
    roomId && roomId !== "All"
      ? `/rooms/warden/history?days=${days}&roomId=${roomId}`
      : `/rooms/warden/history?days=${days}`;

  const { data } = await api.get(query);
  return data;
}

export async function getSecuritySummary(roomId) {
  const { data } = await api.get(`/rooms/security/summary`, {
    params: roomId ? { roomId } : {}
  });
  return data;
}

export async function getSecuritySuspiciousRooms(roomId) {
  const { data } = await api.get(`/rooms/security/suspicious-rooms`, {
    params: roomId ? { roomId } : {}
  });
  return data;
}

export async function getSecurityDoorEvents(roomId, limit = 50) {
  const { data } = await api.get(`/rooms/security/door-events`, {
    params: {
      ...(roomId ? { roomId } : {}),
      limit
    }
  });
  return data;
}

export async function getSecurityTrend(roomId, limit = 200) {
  const { data } = await api.get(`/rooms/security/trend`, {
    params: {
      ...(roomId ? { roomId } : {}),
      limit
    }
  });
  return data;
}

export async function getSecurityAnomalies(roomId, limit = 50) {
  const { data } = await api.get(`/rooms/security/anomalies`, {
    params: {
      ...(roomId ? { roomId } : {}),
      limit
    }
  });
  return data;
}


export async function getStudentOverview(roomId = "A101") {
  const { data } = await api.get(`/rooms/student/${roomId}/overview`);
  return data;
}

export async function getStudentHistory(roomId = "A101") {
  const { data } = await api.get(`/rooms/student/${roomId}/energy/history`);
  return data;
}

export async function getStudentAlerts(roomId = "A101", limit = 20) {
  const { data } = await api.get(`/rooms/student/${roomId}/alerts?limit=${limit}`);
  return data;
}

export async function getWardenFeatureImportance() {
  const res = await api.get("/rooms/warden/feature-importance");
  return res.data;
}

export async function getWardenAnomalies() {
  const res = await api.get("/rooms/warden/anomalies");
  return res.data;
}

export async function getWardenPatterns() {
  const res = await api.get("/rooms/warden/patterns");
  return res.data;
}

export async function getWardenForecasts() {
  const res = await api.get("/rooms/warden/forecasts");
  return res.data;
}
