import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
});

export async function getAvailableFloors() {
  const { data } = await api.get("/rooms/available-floors");
  return data;
}

export async function getAvailableRooms(floorId) {
  const { data } = await api.get("/rooms/available-rooms", {
    params: floorId && floorId !== "All" && floorId !== "all" ? { floorId } : {}
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
    params: floorId && floorId !== "All" && floorId !== "all" ? { floorId } : {}
  });
  return data;
}

export async function getOwnerOverviewSnapshot(floorId = "all") {
  const { data } = await api.get("/rooms/owner/overview-snapshot", {
    params: { floorId }
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

export async function getWardenSummary(roomId = "All") {
  const { data } = await api.get("/rooms/warden/summary", {
    params: { roomId }
  });
  return data;
}

export async function chatWithDashboardAgent(payload) {
  const { data } = await api.post("/chat", payload);
  return data;
}




export async function getWardenRoomsStatus(roomId = "All") {
  const { data } = await api.get("/rooms/warden/rooms-status", {
    params: { roomId }
  });
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
export async function getWardenHistory(roomId = "All", days = 7) {
  const res = await api.get("/rooms/warden/history", {
    params: { roomId, days }
  });
  return res.data;
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

export async function getWardenAnomalies(roomId = "All") {
  const res = await api.get("/rooms/warden/anomalies", {
    params: { roomId }
  });
  return res.data;
}

export async function getWardenPatterns(roomId = "All") {
  const res = await api.get("/rooms/warden/patterns", {
    params: { roomId }
  });
  return res.data;
}

export async function getWardenForecasts(roomId = "All") {
  const res = await api.get("/rooms/warden/forecasts", {
    params: { roomId }
  });
  return res.data;
}

export async function getWardenMlAlerts(roomId = "All", limit = 20) {
  const res = await api.get("/rooms/warden/ml-alerts", {
    params: { roomId, limit }
  });
  return res.data;
}


export async function askDashboardAssistant(question, role = "warden") {
  const { data } = await api.post("/chat/query", { question, role });
  return data;
}

export async function getWardenDataRange(roomId = "All") {
  const res = await api.get("/rooms/warden/data-range", {
    params: { roomId }
  });
  return res.data;
}

