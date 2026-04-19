export function mergeHistoryWithForecast(history = [], forecast = []) {
  const latestActual = history.length ? history[history.length - 1] : null;

  const actual = history.map((item, idx) => ({
    date: item.date,
    total_energy_kwh: item.total_energy_kwh,
    wasted_energy_kwh: item.wasted_energy_kwh,
    predicted_total_energy_kwh:
      idx === history.length - 1 && forecast.length ? item.total_energy_kwh : null,
    predicted_wasted_energy_kwh:
      idx === history.length - 1 && forecast.length ? item.wasted_energy_kwh : null
  }));

  const predicted = forecast.map((item) => ({
    date: item.date,
    total_energy_kwh: null,
    wasted_energy_kwh: null,
    predicted_total_energy_kwh: item.predicted_total_energy_kwh,
    predicted_wasted_energy_kwh: item.predicted_wasted_energy_kwh
  }));

  const filteredPredicted =
    latestActual && forecast.length && forecast[0]?.date === latestActual.date
      ? predicted.slice(1)
      : predicted;

  return [...actual, ...filteredPredicted];
}