const Metrics = ({ metrics }: any) => (
  <div className="metrics-bar">
    {metrics.items.map((m: any) => (
      <div className="metric-item" key={m.label}>
        <span className="metric-value">{m.value}</span>
        <span className="metric-label">{m.label}</span>
      </div>
    ))}
  </div>
);

export default Metrics;
