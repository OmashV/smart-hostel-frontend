import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/rooms/warden";

const api = axios.create({
  baseURL: API_BASE
});

function roomParams(roomId = "All") {
  return { params: { roomId } };
}

export async function getSummary(roomId = "All") {
  const { data } = await api.get("/summary", roomParams(roomId));
  return data;
}

export async function getRoomsStatus(roomId = "All") {
  const { data } = await api.get("/rooms-status", roomParams(roomId));
  return data;
}

export async function getAlerts(roomId = "All") {
  const { data } = await api.get("/ml-alerts", roomParams(roomId));
  return data;
}

export async function getAnomalies(roomId = "All") {
  const { data } = await api.get("/anomalies", roomParams(roomId));
  return data;
}

export async function getPatterns(roomId = "All") {
  const { data } = await api.get("/patterns", roomParams(roomId));
  return data;
}

export async function getForecasts(roomId = "All") {
  const { data } = await api.get("/forecasts", roomParams(roomId));
  return data;
}

export async function getHistory(roomId = "All") {
  const { data } = await api.get("/history", roomParams(roomId));
  return data;
}

export async function getDataRange(roomId = "All") {
  const { data } = await api.get("/data-range", roomParams(roomId));
  return data;
}
