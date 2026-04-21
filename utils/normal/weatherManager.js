const fetch = require('node-fetch');

const API_KEY = process.env.WEATHER_API || 'APIKey';
const API2_KEY = process.env.MOENV_API || 'APIKey';

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
        if (!res.ok) throw new Error(`HTTP 錯誤！狀態碼: ${res.status}`);

        const data = await res.json();

        // 這支 API 回來就是陣列，別再幻想 records
        const rawRecords = Array.isArray(data)
            ? data
            : (data?.records || data?.Records || []);

        if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
            console.warn("真的沒資料，這次才輪到 API 的問題。");
            return null;
        }

        // 正規化（處理 台/臺 + 市）
        const normalize = str =>
            str
                ? str.replace(/台/g, "臺").replace(/市/g, "").trim()
                : "";

        const targetCity = normalize(city);

        // 篩選並轉換
        const filtered = rawRecords
            .filter(r => normalize(r.county).includes(targetCity))
            .map(r => ({
                site: r.sitename || "未知測站",
                location: r.county || city,
                AQI: r.aqi ? Number(r.aqi) : null,
                PM25: r["pm2.5"] || r["pm2_5"] || null,
                status: r.status || "N/A",
                publishTime: r.publishtime || "未知時間"
            }));

        return filtered.length > 0 ? filtered : null;

    } catch (err) {
        console.error("AirQuality 炸了，不是你就是 API:", err.message);
        return null;
    }
}
// ---------- 地震 ----------
async function getEarthquake() {
    try {
        const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0015-001?Authorization=${API_KEY}&limit=1&format=JSON`;
        const res = await fetch(url);
        const data = await res.json();

        const latest = data.records?.Earthquake?.[0];
        if (!latest) return null;

        const info = latest.EarthquakeInfo || {};
        const epicenter = info.Epicenter || {};

        return {
            date: info.OriginTime || 'N/A',
            dateLocal: info.OriginTime
                ? new Date(info.OriginTime).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
                : 'N/A',
            location: epicenter.Location || '未知地點',
            magnitude: info.EarthquakeMagnitude?.MagnitudeValue ?? 'N/A',
            depth: info.FocalDepth ?? 'N/A',
            report: latest.ReportContent ?? '',
            reportImage: latest.ReportImageURI ?? null,
            shakemap: latest.ShakemapImageURI ?? null
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

        // 取分析資料最新位置
        const fixes = latestCyclone.analysisData?.fix;
        if (!fixes || fixes.length === 0) return null;
        const latestFix = fixes[fixes.length - 1];
        const [lon, lat] = latestFix.coordinate.split(',').map(Number);

        // 嘗試抓 forecastData 的 stateTransfers
        let status = 'N/A';
        const forecastFixes = latestCyclone.forecastData?.fix;
        if (forecastFixes && forecastFixes.length > 0) {
            for (let i = forecastFixes.length - 1; i >= 0; i--) {
                const fix = forecastFixes[i];
                if (fix.stateTransfers) {
                    const zh = fix.stateTransfers.find(s => s.lang === 'zh-hant');
                    if (zh) {
                        status = zh.value;
                        break;
                    }
                }
            }
        }

        return {
            name: latestCyclone.cwaTyphoonName || '未知', // 中文名
            enName: latestCyclone.typhoonName || 'N/A', // 英文名
            status, // 狀態
            lat,
            lon,
            windSpeed: latestFix.maxWindSpeed ?? 0
        };

    } catch (err) {
        console.error("Typhoon API Error:", err);
        return null;
    }
}
//豪大雨特報
async function getHeavyRain() {
    try {
        const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001?Authorization=${API_KEY}&limit=1&format=JSON`;
        const res = await fetch(url);
        const data = await res.json();

        const latest = data.records?.location?.[0]; // 取最新一筆
        if (!latest) return null;

        return {
            location: latest.locationName ?? '未知地點',
            startTime: latest.startTime ?? 'N/A',
            endTime: latest.endTime ?? 'N/A',
            rainfall: latest.parameter?.parameterName ?? 'N/A',
            description: latest.parameter?.parameterValue ?? 'N/A'
        };
    } catch (err) {
        console.error("Heavy Rain API Error:", err);
        return null;
    }
}


module.exports = {
    getWeather,
    getAirQuality,
    getEarthquake,
    getHeavyRain,
    getTyphoon
};

