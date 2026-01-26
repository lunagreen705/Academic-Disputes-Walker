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
async function getAirQuality(inputQuery) {
    // 雖然不想承認，但有些 API 就是這麼慢，設個 timeout 是基本素養
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒不回就切斷，別浪費生命

    try {
        // 把 API Key 抽離或是確保環境變數存在，這裡假設你已經處理好了
        const url = `https://data.moenv.gov.tw/api/v2/aqx_p_432?language=zh&api_key=${API2_KEY}`;
        
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId); // 成功拿到就取消計時器，節省資源

        if (!res.ok) throw new Error(`API 請求失敗: ${res.status}`);

        const data = await res.json();
        if (!data.records) return null;

        // --- 核心優化區 ---
        
        // 1. 標準化函式：拔掉干擾項（台/臺、市、縣），統一轉乾淨
        // 這樣 "臺北市"、"台北"、"台北市" 最後都會變成 "台北"
        const cleanName = str => str
            .replace(/臺/g, "台") // 統一用台
            .replace(/[縣市]/g, "") // 拔掉行政區後綴
            .trim();

        const target = cleanName(inputQuery);

        // 2. 模糊比對：只要 API 的縣市名稱處理後包含你的目標，或者測站名稱包含目標，都算中
        const records = data.records.filter(r => {
            const apiCounty = cleanName(r.county);
            const apiSite = cleanName(r.sitename);
            
            // 邏輯：輸入 "基隆" -> 抓到 "基隆市" (縣市) 或 "基隆" (測站)
            return apiCounty === target || apiSite === target;
        });

        if (!records.length) {
            console.warn(`找無此地資料: ${inputQuery} (你是輸入了火星文嗎？)`);
            return null;
        }

        // 3. 資料清洗：映射回傳，防呆處理
        return records.map(r => ({
            site: r.sitename || "未知測站", // 居然會有測站沒名字？公部門 API 不意外
            county: r.county || "未知縣市", 
            AQI: r.aqi || "N/A",
            PM25: r["pm2.5"] || "N/A",
            status: r.status || "機器壞了", // Status 若空大概是感測器掛了
            publishTime: r.publishtime || new Date().toLocaleString()
        }));

    } catch (err) {
        if (err.name === 'AbortError') {
            console.error("請求超時，那破伺服器估計又卡了");
        } else {
            console.error("AirQuality 炸了:", err);
        }
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

