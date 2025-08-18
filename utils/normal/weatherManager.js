const fetch = require('node-fetch');

const API_KEY = process.env.WEATHER_API || '你的APIKey';

// ---------- 天氣 ----------
async function getWeather(city) {
    try {
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
    } catch (err) {
        console.error("Weather API Error:", err);
        return null;
    }
}

// ---------- 空氣品質 ----------
async function getAirQuality(city) {
    try {
        const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/AQX_P_432?Authorization=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.records || !data.records.records) return null;

        const record = data.records.records.find(r => r.County.includes(city));
        if (!record) return null;

        return {
            location: record.County,
            AQI: record.AQI,
            PM25: record['PM2.5'],
            status: record.Status
        };
    } catch (err) {
        console.error("AirQuality API Error:", err);
        return null;
    }
}

// ---------- 地震速報 ----------
async function getEarthquake() {
    try {
        const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0015-001?Authorization=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.records || !data.records.earthquake?.length) return null;

        const latest = data.records.earthquake[0];

        return {
            date: latest.earthquakeInfo.originTime,
            location: latest.earthquakeInfo.epicenter.location,
            magnitude: latest.earthquakeInfo.magnitude.magnitudeValue,
            depth: latest.earthquakeInfo.focalDepth,
            intensity: latest.intensity.shakingArea[0]?.areaDesc || "N/A"
        };
    } catch (err) {
        console.error("Earthquake API Error:", err);
        return null;
    }
}

// ---------- 颱風 ----------
async function getTyphoon() {
    try {
        const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0034-005?Authorization=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.records || !data.records.typhoon?.length) return null;

        const latest = data.records.typhoon[0];
        return {
            name: latest.typhoonName,
            enName: latest.typhoonEnName,
            status: latest.typhoonStatus,
            lat: latest.typhoonLat,
            lon: latest.typhoonLon,
            windSpeed: latest.maxWindSpeed
        };
    } catch (err) {
        console.error("Typhoon API Error:", err);
        return null;
    }
}

module.exports = {
    getWeather,
    getAirQuality,
    getEarthquake,
    getTyphoon
};
