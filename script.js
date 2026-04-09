const datetimeEl = document.getElementById("datetime");
const weatherEl = document.getElementById("weather");
const poemEl = document.getElementById("poem");
const statusEl = document.getElementById("status");
const loadBtn = document.getElementById("loadBtn");

function formatDateTime() {
  const now = new Date();

  const date = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric"
  });

  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });

  return `${date}, ${time}`;
}

async function loadWeather(lat, lon) {
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;

    const response = await fetch(weatherUrl);
    console.log("Weather response:", response);

    if (!response.ok) {
      throw new Error(`Weather request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log("Weather data:", data);

    const temp = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;

    let condition = "Unknown";
    if (code === 0) condition = "Clear";
    else if ([1, 2, 3].includes(code)) condition = "Cloudy";
    else if ([45, 48].includes(code)) condition = "Foggy";
    else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) condition = "Rainy";
    else if ([71, 73, 75, 77, 85, 86].includes(code)) condition = "Snowy";
    else if ([95, 96, 99].includes(code)) condition = "Stormy";

    weatherEl.textContent = `${condition} · ${temp}°`;
  } catch (error) {
    console.error("Weather error:", error);
    weatherEl.textContent = "Could not load weather.";
  }
}

async function loadPoem() {
  try {
    const poemUrl = "https://poetrydb.org/title/Ozymandias/lines.json";

    const poemResponse = await fetch(poemUrl);
    console.log("Poem response:", poemResponse);

    if (!poemResponse.ok) {
      throw new Error(`Poem request failed: ${poemResponse.status}`);
    }

    const poemData = await poemResponse.json();
    console.log("Poem data:", poemData);

    if (poemData[0] && poemData[0].lines) {
      const line = poemData[0].lines[0];
      poemEl.textContent = `"${line}"`;
    } else {
      poemEl.textContent = "No line arrived.";
    }
  } catch (error) {
    console.error("Poem error:", error);
    poemEl.textContent = "Could not load poem.";
  }
}

async function loadMoment() {
  datetimeEl.textContent = formatDateTime();
  weatherEl.textContent = "Loading weather...";
  poemEl.textContent = "Loading a line...";
  statusEl.textContent = "Asking for location...";

  if (!navigator.geolocation) {
    statusEl.textContent = "Geolocation is not supported in this browser.";
    weatherEl.textContent = "Could not get location.";
    poemEl.textContent = "Still, the moment is here.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      statusEl.textContent = "Location found. Loading weather and poem...";

      await loadWeather(lat, lon);
      await loadPoem();

      statusEl.textContent = "Moment loaded.";
    },
    (error) => {
      console.error("Geolocation error:", error);
      statusEl.textContent = "Location permission was denied or unavailable.";
      weatherEl.textContent = "Could not get location.";
      poemEl.textContent = "A soft line still belongs here.";
    }
  );
}

loadBtn.addEventListener("click", loadMoment);
datetimeEl.textContent = formatDateTime();