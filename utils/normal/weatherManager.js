const fetch = require('node-fetch');

const API_KEY = process.env.WEATHER_API || '你的APIKey';

// ---------- 天氣 ----------
async function getWeather(city) {
    const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001?Authorization=${API_KEY}&locationName=${encodeURIComponent(city)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.records || !data.records.location[0]) return null;

    const location = data.records.location[0];
    const weather = location.weatherElement;

    return {
        location: location.locationName,
        description: weather[0].time[0].parameter.parameterName,
        rain: weather[1].time[0].parameter.parameterName,
        minTemp: weather[2].time[0].parameter.parameterName,
        maxTemp: weather[4].time[0].parameter.parameterName
    };
}

// ---------- 空氣品質 ----------
async function getAirQuality(city) {
    const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/AQX_P_432?Authorization=${API_KEY}&locationName=${encodeURIComponent(city)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.records || !data.records.location[0]) return null;

    const location = data.records.location[0];

    return {
        location: location.County,
        AQI: location.AQI,
        PM25: location['PM2.5'],
        status: location.Status
    };
}

// ---------- 地震速報 ----------
async function getEarthquake() {
    const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0015-001?Authorization=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.records || !data.records.earthquake || !data.records.earthquake.length) return null;

    const latest = data.records.earthquake[0];

    return {
        date: latest.origintime,
        location: latest.epicenter,
        magnitude: latest.magnitude,
        depth: latest.depth,
        intensity: latest.intensity
    };
}

// ---------- 颱風 ----------
async function getTyphoon() {
    const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0035-001?Authorization=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.records || !data.records.typhoon || !data.records.typhoon.length) return null;

    // 取最新颱風
    const latest = data.records.typhoon[0];
    return {
        name: latest.typhoonName,
        enName: latest.typhoonEnName,
        status: latest.typhoonStatus,
        lat: latest.typhoonLat,
        lon: latest.typhoonLon,
        windSpeed: latest.maxWindSpeed
    };
}

module.exports = {
    getWeather,
    getAirQuality,
    getEarthquake,
    getTyphoon
};
