/*  Fetches weather data from the Open-Meteo API based on latitude and longitude.
 * @param {number} lat - The latitude of the location for which to fetch weather data.*/
export async function fetchWeather(lat, lon) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,precipitation_probability_max&temperature_unit=fahrenheit&timezone=auto`,
  );

  const data = await res.json();
  return data;
}
