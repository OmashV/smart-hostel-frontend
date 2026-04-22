import { api } from "../../../api/client";
import { DEFAULT_STUDENT_ROOM_ID } from "../constants/studentConstants";
import {
  normalizeStudentAlertsResponse,
  normalizeStudentEnergyHistoryResponse,
  normalizeStudentNoiseHistoryResponse,
  normalizeStudentOverviewResponse
} from "../models/studentModels";

function resolveRoomId(roomId) {
  return roomId || DEFAULT_STUDENT_ROOM_ID;
}

export async function getStudentOverview(roomId = DEFAULT_STUDENT_ROOM_ID, params = {}) {
  const targetRoom = resolveRoomId(roomId);
  const { data } = await api.get(`/rooms/student/${targetRoom}/overview`, { params });
  return normalizeStudentOverviewResponse(data);
}

export async function getStudentEnergyHistory(roomId = DEFAULT_STUDENT_ROOM_ID, params = {}) {
  const targetRoom = resolveRoomId(roomId);
  const { data } = await api.get(`/rooms/student/${targetRoom}/energy/history`, { params });
  return normalizeStudentEnergyHistoryResponse(data);
}

export async function getStudentAlerts(roomId = DEFAULT_STUDENT_ROOM_ID, params = {}) {
  const targetRoom = resolveRoomId(roomId);
  const { data } = await api.get(`/rooms/student/${targetRoom}/alerts`, {
    params: {
      limit: 20,
      ...params
    }
  });
  return normalizeStudentAlertsResponse(data);
}

export async function getStudentNoiseHistory(roomId = DEFAULT_STUDENT_ROOM_ID, params = {}) {
  const targetRoom = resolveRoomId(roomId);
  const { data } = await api.get(`/rooms/student/${targetRoom}/noise/history`, { params });
  return normalizeStudentNoiseHistoryResponse(data);
}

export async function getStudentAlertsSummary(roomId = DEFAULT_STUDENT_ROOM_ID, params = {}) {
  const targetRoom = resolveRoomId(roomId);
  const { data } = await api.get(`/rooms/student/${targetRoom}/alerts/summary`, { params });
  return data;
}

export async function getStudentEnergyComparison(roomId = DEFAULT_STUDENT_ROOM_ID, params = {}) {
  const targetRoom = resolveRoomId(roomId);
  const { data } = await api.get(`/rooms/student/${targetRoom}/energy/comparison`, { params });
  return data;
}

export async function getStudentEnergyForecast(roomId = DEFAULT_STUDENT_ROOM_ID, params = {}) {
  const targetRoom = resolveRoomId(roomId);
  const { data } = await api.get(`/rooms/student/${targetRoom}/energy/forecast`, { params });
  return data;
}

export async function getStudentEnergyForecastPreview(roomId = DEFAULT_STUDENT_ROOM_ID, params = {}) {
  return getStudentEnergyForecast(roomId, params);
}

export async function getStudentRecommendations(roomId = DEFAULT_STUDENT_ROOM_ID, params = {}) {
  const targetRoom = resolveRoomId(roomId);
  const { data } = await api.get(`/rooms/student/${targetRoom}/recommendations`, { params });
  return data;
}
