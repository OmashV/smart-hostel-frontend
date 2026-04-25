import StudentStatusBadge from "./StudentStatusBadge";
import { formatAmp, formatTimestamp } from "../utils/overviewHelpers";

const statusLabels = [
  { key: "occupancy", label: "Occupancy" },
  { key: "noiseStatus", label: "Noise" },
  { key: "wasteStatus", label: "Waste" },
  { key: "doorStatus", label: "Door" },
  { key: "currentAmp", label: "Current (A)" },
  { key: "updatedAt", label: "Updated At" }
];

export default function StudentStatusCard({ status }) {
  const valueRenderers = {
    occupancy: (value) => <StudentStatusBadge value={value} />,
    noiseStatus: (value) => <StudentStatusBadge value={value} />,
    wasteStatus: (value) => <StudentStatusBadge value={value} />,
    doorStatus: (value) => <StudentStatusBadge value={value} />,
    currentAmp: (value) => formatAmp(value),
    updatedAt: (value) => formatTimestamp(value)
  };

  return (
    <dl className="student-status-grid">
      {statusLabels.map((item) => (
        <div key={item.key} className="student-status-item">
          <dt>{item.label}</dt>
          <dd>
            {valueRenderers[item.key]
              ? valueRenderers[item.key](status?.[item.key])
              : status?.[item.key] ?? "--"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
