export const DEFAULT_STUDENT_ROOM_ID = "A101";

export const STUDENT_ROUTE_PATHS = Object.freeze({
  root: "/student",
  overview: "/student/overview",
  energy: "/student/energy",
  noise: "/student/noise",
  alerts: "/student/alerts"
});

export const DEFAULT_STUDENT_FILTERS = Object.freeze({
  roomId: DEFAULT_STUDENT_ROOM_ID,
  dateRange: "7d",
  alertType: "all",
  severity: "all",
  viewMode: "list"
});

export const STUDENT_PAGE_DESCRIPTIONS = Object.freeze({
  overview: "See your room status, core KPIs, and recent recommendations in one place.",
  energy: "Review daily energy and waste history with placeholders ready for deeper analytics.",
  noise: "Track room noise behavior and incident summaries for upcoming monitoring features.",
  alerts: "Review personal alert activity with a clean filter-ready structure."
});

