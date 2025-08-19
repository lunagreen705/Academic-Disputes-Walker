const fetch = require('node-fetch');

const API_KEY = process.env.WEATHER_API || '你的APIKey';
const API2_KEY = process.env.MOENV_API || '你的APIKey';

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
        const url = `https://data.moenv.gov.tw/api/v2/aqx_p_432?language=zh&api_key=${API2_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.records) return null;

        // 縣市名稱正規化（台/臺）
        const normalize = str => str.replace("台", "臺").trim();

        // 找出符合縣市的所有測站
        const records = data.records.filter(r => normalize(r.county) === normalize(city));

        if (!records.length) return null;

        // 統一處理欄位，避免 undefined
        return records.map(r => ({
            site: r.sitename || "未知測站",
            location: r.county || city,
            AQI: r.aqi || "N/A",
            PM25: r["pm2.5"] || "N/A",
            status: r.status || "N/A",
            publishTime: r.publishtime || "未知時間"
        }));
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

        const cyclones = data.records?.tropicalCyclones?.tropicalCyclone;
        if (!cyclones || cyclones.length === 0) return null;

        const latestCyclone = cyclones[0];
        const fixes = latestCyclone.analysisData?.fix;
        if (!fixes || fixes.length === 0) return null;

        const latestFix = fixes[fixes.length - 1]; // 取最新一筆分析資料
        const [lon, lat] = latestFix.coordinate.split(',').map(Number);

        return {
            name: latestCyclone.typhoonName || latestCyclone.cwaTyphoonName,
            status: latestCyclone.typhoonStatus || 'N/A',
            lat,
            lon,
            windSpeed: latestFix.maxWindSpeed
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
