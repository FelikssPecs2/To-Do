const searchBtn = document.getElementById('searchBtn');
const cityInput = document.getElementById('cityInput');
const suggestionsBox = document.getElementById('suggestionsBox');
const errorBox = document.getElementById('errorBox');

searchBtn.addEventListener('click', () => {
  const cityName = cityInput.value.trim();
  if (cityName !== "") {
    if (errorBox) errorBox.style.display = 'none';
    getWeatherDataByName(cityName);
    suggestionsBox.innerHTML = '';
  }
});

cityInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchBtn.click();
  }
});

cityInput.addEventListener('input', async () => {
  const query = cityInput.value.trim();
  
  if (query.length < 2) {
    suggestionsBox.innerHTML = '';
    return;
  }

  const geoUrl = `api/api.php?endpoint=geo&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(geoUrl);
    const cities = await response.json();

    suggestionsBox.innerHTML = '';

    if (!Array.isArray(cities) || cities.length === 0) {
      return;
    }

    cities.forEach(city => {
      const div = document.createElement('div');
      div.classList.add('suggestion-item');
      const stateInfo = city.state ? `, ${city.state}` : '';
      div.textContent = `${city.name}${stateInfo}, ${city.country}`;

      div.addEventListener('click', () => {
        cityInput.value = `${city.name}, ${city.country}`;
        suggestionsBox.innerHTML = '';
        if (errorBox) errorBox.style.display = 'none';
        getWeatherDataByCoords(city.lat, city.lon, city.name);
      });

      suggestionsBox.appendChild(div);
    });
  } catch (error) {
    console.error("Error:", error);
  }
});

document.addEventListener('click', (e) => {
  if (!cityInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
    suggestionsBox.innerHTML = '';
  }
});

async function getWeatherDataByCoords(lat, lon, customName = null) {
  const url = `api/api.php?endpoint=weather&lat=${lat}&lon=${lon}`;
  fetchAndShowWeather(url, customName);
}

async function getWeatherDataByName(city) {
  const url = `api/api.php?endpoint=weather&q=${encodeURIComponent(city)}`;
  fetchAndShowWeather(url);
}

async function fetchAndShowWeather(url, customName = null) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok || (data.cod && data.cod !== 200)) {
      if (errorBox) {
        errorBox.style.display = 'flex';
      }
      return;
    }

    if (errorBox) {
      errorBox.style.display = 'none';
    }

    if (customName) {
      data.name = customName;
    }

    updateWeatherUI(data);

  } catch (error) {
    if (errorBox) {
      errorBox.style.display = 'flex';
    }
    console.error("Error:", error);
  }
}

function updateWeatherUI(data) {
  document.getElementById('cityName').textContent = data.name;
  document.getElementById('weatherDesc').textContent = data.weather[0].description;
  
  const temp = Math.round(data.main.temp);
  document.getElementById('weatherTemp').textContent = `${temp > 0 ? '+' : ''}${temp}°`;
  
  const utcTime = new Date().getTime() + (new Date().getTimezoneOffset() * 60000);
  const cityTime = new Date(utcTime + (data.timezone * 1000));
  
  const hours = String(cityTime.getHours()).padStart(2, '0');
  const minutes = String(cityTime.getMinutes()).padStart(2, '0');
  document.getElementById('weatherTime').textContent = `${hours}.${minutes}`;

  const iconCode = data.weather[0].icon;
  document.getElementById('weatherIcon').innerHTML = `<img src="https://openweathermap.org/img/wn/${iconCode}.png" alt="weather icon" style="width: 35px; vertical-align: middle;">`;

  document.getElementById('humidityVal').textContent = `${data.main.humidity}%`;
  document.getElementById('windVal').textContent = `${data.wind.speed} m/s`;

  const maxTemp = Math.round(data.main.temp_max);
  const minTemp = Math.round(data.main.temp_min);
  document.getElementById('minMaxTempVal').textContent = `${maxTemp > 0 ? '+' : ''}${maxTemp}°/${minTemp > 0 ? '+' : ''}${minTemp}°`;

  document.getElementById('pressureVal').textContent = `${data.main.pressure} hPa`;

  const visibilityKm = (data.visibility / 1000).toFixed(1);
  document.getElementById('visibilityVal').textContent = `${visibilityKm} km`;

  const feelsLike = Math.round(data.main.feels_like);
  document.getElementById('feelsLikeVal').textContent = `${feelsLike > 0 ? '+' : ''}${feelsLike}°`;

  updateBackgroundByTime(cityTime.getHours());
}

function updateBackgroundByTime(hour) {
  document.body.className = '';
  
  if (hour >= 21 || hour < 5) {
    document.body.classList.add('time-night');
  } else if (hour >= 5 && hour < 9) {
    document.body.classList.add('time-morning');
  } else if (hour >= 9 && hour < 16) {
    document.body.classList.add('time-day');
  } else {
    document.body.classList.add('time-evening');
  }
}

function loadWeather(location) {
  let url = "";
  if (location.lat && location.lon) {
    url = `api/api.php?endpoint=weather&lat=${location.lat}&lon=${location.lon}`;
  } else if (location.city) {
    url = `api/api.php?endpoint=weather&q=${encodeURIComponent(location.city)}`;
  }
  fetchAndShowWeather(url);
}

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWeather({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => loadWeather({ city: "Riga" }), 
    { timeout: 8000 }
  );
} else {
  loadWeather({ city: "Riga" }); 
}