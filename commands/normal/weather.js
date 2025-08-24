const { EmbedBuilder } = require('discord.js');
const cwa = require('../../utils/normal/weatherManager.js'); // 路徑依專案調整

// 🔽 台灣縣市清單 (中央氣象署格式)
const cityChoices = [
    { name: '基隆市', value: '基隆市' },
    { name: '臺北市', value: '臺北市' },
    { name: '新北市', value: '新北市' },
    { name: '桃園市', value: '桃園市' },
    { name: '新竹市', value: '新竹市' },
    { name: '新竹縣', value: '新竹縣' },
    { name: '苗栗縣', value: '苗栗縣' },
    { name: '臺中市', value: '臺中市' },
    { name: '彰化縣', value: '彰化縣' },
    { name: '南投縣', value: '南投縣' },
    { name: '雲林縣', value: '雲林縣' },
    { name: '嘉義市', value: '嘉義市' },
    { name: '嘉義縣', value: '嘉義縣' },
    { name: '臺南市', value: '臺南市' },
    { name: '高雄市', value: '高雄市' },
    { name: '屏東縣', value: '屏東縣' },
    { name: '宜蘭縣', value: '宜蘭縣' },
    { name: '花蓮縣', value: '花蓮縣' },
    { name: '臺東縣', value: '臺東縣' },
    { name: '澎湖縣', value: '澎湖縣' },
    { name: '金門縣', value: '金門縣' },
    { name: '連江縣', value: '連江縣' },
];

module.exports = {
    name: '氣象',
    description: '中央氣象署公開資訊查詢',
    options: [
        {
            name: '天氣',
            description: '查詢指定縣市的天氣預報',
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: '城市',
                    description: '選擇要查詢的縣市',
                    type: 3, // STRING
                    required: true,
                    choices: cityChoices, // ✅ 下拉選單
                },
            ],
        },
        {
            name: '空氣',
            description: '查詢指定縣市的空氣品質',
            type: 1, // SUB_COMMAND
            options: [
                {
                    name: '城市',
                    description: '選擇要查詢的縣市',
                    type: 3, // STRING
                    required: true,
                    choices: cityChoices, // ✅ 下拉選單
                },
            ],
        },
        {
            name: '地震',
            description: '查詢最新的地震速報',
            type: 1, // SUB_COMMAND
        },
        {
            name: '颱風',
            description: '查詢最新的颱風資訊',
            type: 1, // SUB_COMMAND
        },
    ],

    run: async (client, interaction) => {
        const subCommand = interaction.options.getSubcommand();
        await interaction.deferReply();

        // 天氣
        if (subCommand === '天氣') {
            const city = interaction.options.getString('城市');
            const weatherData = await cwa.getWeather(city);
            if (!weatherData) {
                return interaction.editReply({ content: `❌ 找不到 **${city}** 的天氣資訊。` });
            }

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`📍 ${weatherData.location} 天氣預報`)
                .addFields(
                    { name: '天氣狀況', value: weatherData.description, inline: true },
                    { name: '降雨機率', value: `${weatherData.rain}%`, inline: true },
                    { name: '最低溫', value: `${weatherData.minTemp}°C`, inline: true },
                    { name: '最高溫', value: `${weatherData.maxTemp}°C`, inline: true },
                )
                .setTimestamp()
                .setFooter({ text: '資料來源：中央氣象署' });

            return interaction.editReply({ embeds: [embed] });
        }

   // 空氣品質
if (subCommand === '空氣') {
    const city = interaction.options.getString('城市');
    const aqiData = await cwa.getAirQuality(city);

    if (!aqiData || aqiData.length === 0) {
        return interaction.editReply({ content: `❌ 找不到 **${city}** 的空氣品質資訊。` });
    }

    // 如果只有一個測站，就單筆顯示
    if (aqiData.length === 1) {
        const record = aqiData[0];
        const embed = new EmbedBuilder()
            .setColor('#66cc66')
            .setTitle(`🌬️ ${record.location} - ${record.site} 空氣品質`)
            .addFields(
                { name: 'AQI 指數', value: String(record.AQI), inline: true },
                { name: 'PM2.5', value: String(record.PM25), inline: true },
                { name: '狀態', value: record.status, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: '資料來源：環境部開放資料平台' });

        return interaction.editReply({ embeds: [embed] });
    }

    // 如果有多個測站，就列出多筆（避免 embed 爆炸，最多顯示 5 筆）
    const embeds = aqiData.slice(0, 5).map(record =>
        new EmbedBuilder()
            .setColor('#66cc66')
            .setTitle(`🌬️ ${record.location} - ${record.site} 空氣品質`)
            .addFields(
                { name: 'AQI 指數', value: String(record.AQI), inline: true },
                { name: 'PM2.5', value: String(record.PM25), inline: true },
                { name: '狀態', value: record.status, inline: true }
            )
            .setFooter({ text: '資料來源：環境部開放資料平台' })
            .setTimestamp()
    );

    return interaction.editReply({ embeds });
}
   // 地震速報
if (subCommand === '地震') {
    const eqData = await getEarthquake();
    if (!eqData) {
        return interaction.editReply({ content: '✅ 目前沒有最新的地震速報資訊。' });
    }
    const embed = new EmbedBuilder()
        .setColor('#ff4d4d')
        .setTitle('🚨 最新地震速報')
        .setDescription(`**${eqData.location}** 發生有感地震`)
        .addFields(
            { name: '發生時間', value: eqData.dateLocal, inline: false },
            { name: '芮氏規模', value: `**${eqData.magnitude}**`, inline: true },
            { name: '地震深度', value: `${eqData.depth} 公里`, inline: true },
            { name: '報告內容', value: eqData.report || 'N/A' }
        )
        .setImage(eqData.shakemap || eqData.reportImage) // 先震度圖，再報告圖
        .setTimestamp()
        .setFooter({ text: '資料來源：中央氣象署' });

    return interaction.editReply({ embeds: [embed] });
}

        // 颱風
        if (subCommand === '颱風') {
            const typhoonData = await cwa.getTyphoon();
            if (!typhoonData) {
                return interaction.editReply({ content: '✅ 目前沒有颱風警報資訊。' });
            }

            const embed = new EmbedBuilder()
                .setColor('#8a2be2')
                .setTitle(`🌀 最新颱風動態 - ${typhoonData.name} (${typhoonData.enName})`)
                .addFields(
                    { name: '狀態', value: typhoonData.status, inline: true },
                    { name: '中心位置', value: `東經 ${typhoonData.lon}° / 北緯 ${typhoonData.lat}°`, inline: true },
                    { name: '最大風速', value: `${typhoonData.windSpeed} 公尺/秒`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: '資料來源：中央氣象署' });

            return interaction.editReply({ embeds: [embed] });
        }
    },
};
