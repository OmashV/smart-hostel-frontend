export default function DesignNotes() {
    return (
      <div className="page-grid">
        <section className="section-card">
          <h2>User Personas</h2>
          <ul>
            <li><strong>Owner:</strong> strategic energy and waste monitoring, trends, forecast.</li>
            <li><strong>Warden:</strong> room occupancy, room conditions, noise and inspections.</li>
            <li><strong>Security:</strong> suspicious movement, door activity, unresolved incidents.</li>
            <li><strong>Student:</strong> personal room usage, waste awareness, alerts.</li>
          </ul>
        </section>
  
        <section className="section-card">
          <h2>Analytical Goals</h2>
          <ul>
            <li>Reduce energy waste.</li>
            <li>Spot empty rooms consuming power.</li>
            <li>Track room activity and behavior problems.</li>
            <li>Forecast near-future energy waste.</li>
          </ul>
        </section>
  
        <section className="section-card">
          <h2>User Flow</h2>
          <ol>
            <li>Select role.</li>
            <li>Scan KPI cards.</li>
            <li>Inspect linked charts and tables.</li>
            <li>Filter by room or forecast days.</li>
            <li>Drill into suspicious or high-waste items.</li>
          </ol>
        </section>
  
        <section className="section-card">
          <h2>Usability and Accessibility</h2>
          <ul>
            <li>High-contrast cards and labels.</li>
            <li>Consistent page layout and spacing.</li>
            <li>Color is paired with text badges, not used alone.</li>
            <li>Clear section ordering from summary to detail.</li>
          </ul>
        </section>
      </div>
    );
  }