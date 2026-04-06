export function mergeHistoryWithForecast(history = [], forecast = []) {
    const actual = history.map((item) => ({
      date: item.date,
      total_energy_kwh: item.total_energy_kwh,
      wasted_energy_kwh: item.wasted_energy_kwh,
      predicted_total_energy_kwh: null,
      predicted_wasted_energy_kwh: null
    }));
  
    const predicted = forecast.map((item) => ({
      date: item.date,
      total_energy_kwh: null,
      wasted_energy_kwh: null,
      predicted_total_energy_kwh: item.predicted_total_energy_kwh,
      predicted_wasted_energy_kwh: item.predicted_wasted_energy_kwh
    }));
  
    return [...actual, ...predicted];
  }