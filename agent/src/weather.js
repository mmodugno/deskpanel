const CODES = [
  [[0], 'Despejado'],
  [[1, 2], 'Poco nublado'],
  [[3], 'Nublado'],
  [[45, 48], 'Niebla'],
  [[51, 53, 55, 56, 57], 'Llovizna'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Lluvia'],
  [[71, 73, 75, 77, 85, 86], 'Nieve'],
  [[95, 96, 99], 'Tormenta'],
];

export function describeCode(code) {
  return CODES.find(([codes]) => codes.includes(code))?.[1] ?? 'Sin datos';
}

export async function fetchWeather({ latitude, longitude, name }, fetchImpl = fetch) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m,weather_code&timezone=auto';
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
  const data = await res.json();
  return {
    name,
    temp: Math.round(data.current.temperature_2m),
    text: describeCode(data.current.weather_code),
  };
}

export function startWeather(bus, location, everyMs = 15 * 60 * 1000) {
  if (!location) return () => {};
  const refresh = () =>
    fetchWeather(location)
      .then((w) => bus.publish('weather', w))
      .catch(() => {}); // sin internet: se conserva el último dato
  const timer = setInterval(refresh, everyMs);
  timer.unref();
  refresh();
  return () => clearInterval(timer);
}
