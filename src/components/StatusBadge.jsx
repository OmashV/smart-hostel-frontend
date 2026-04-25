export default function StatusBadge({ value }) {
  const dangerValues = ["Critical", "Violation", "Open", "Fault"];
  const warningValues = ["Warning", "Stale"];
  const infoValues = ["Occupied", "Sleeping"];
  const okValues = ["Normal", "Closed", "Empty", "Healthy"];

  let cls = "badge neutral";

  if (dangerValues.includes(value)) cls = "badge danger";
  else if (warningValues.includes(value)) cls = "badge warning";
  else if (infoValues.includes(value)) cls = "badge info";
  else if (okValues.includes(value)) cls = "badge ok";

  return <span className={cls}>{value || "No Data"}</span>;
}
