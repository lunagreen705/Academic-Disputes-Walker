const { EmbedBuilder } = require('discord.js');
// 根據你的資料夾結構，路徑可能需要調整
const cwa = require('../../utils/normal/weatherManager.js'); 

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
          description: '要查詢的縣市名稱',
          type: 3, // STRING
          required: true,
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
          description: '要查詢的縣市名稱',
          type: 3, // STRING
          required: true,
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
    
    // 將回應設為僅自己可見 (ephemeral)
    await interaction.deferReply({ ephemeral: true });

    if (subCommand === 'weather') {
      const city = interaction.options.getString('city');
      try {
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
            { name: '\u200B', value: '\u200B' },
            { name: '最低溫', value: `${weatherData.minTemp}°C`, inline: true },
            { name: '最高溫', value: `${weatherData.maxTemp}°C`, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: '資料來源：中央氣象署' });

        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error(error);
        return interaction.editReply({ content: '⚠️ 查詢天氣時發生錯誤，請稍後再試。' });
      }
    }

    if (subCommand === 'aqi') {
      const city = interaction.options.getString('city');
      try {
        const aqiData = await cwa.getAirQuality(city);
        if (!aqiData) {
          return interaction.editReply({ content: `❌ 找不到 **${city}** 的空氣品質資訊。` });
        }

        const embed = new EmbedBuilder()
          .setColor('#66cc66')
          .setTitle(`🌬️ ${aqiData.location} 空氣品質`)
          .addFields(
            { name: 'AQI 指數', value: aqiData.AQI, inline: true },
            { name: 'PM2.5', value: aqiData.PM25, inline: true },
            { name: '狀態', value: aqiData.status, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: '資料來源：中央氣象署' });

        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error(error);
        return interaction.editReply({ content: '⚠️ 查詢空氣品質時發生錯誤，請稍後再試。' });
      }
    }

    if (subCommand === 'earthquake') {
      try {
        const eqData = await cwa.getEarthquake();
        if (!eqData) {
          return interaction.editReply({ content: '✅ 目前沒有最新的地震速報資訊。' });
        }

        const embed = new EmbedBuilder()
          .setColor('#ff4d4d')
          .setTitle('🚨 最新地震速報')
          .setDescription(`**${eqData.location}** 發生有感地震`)
          .addFields(
            { name: '發生時間', value: eqData.date },
            { name: '芮氏規模', value: `**${eqData.magnitude}**`, inline: true },
            { name: '地震深度', value: `${eqData.depth} 公里`, inline: true },
            { name: '各地最大震度', value: eqData.intensity }
          )
          .setTimestamp()
          .setFooter({ text: '資料來源：中央氣象署' });
        
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error(error);
        return interaction.editReply({ content: '⚠️ 查詢地震速報時發生錯誤，請稍後再試。' });
      }
    }

    if (subCommand === 'typhoon') {
      try {
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
      } catch (error) {
        console.error(error);
        return interaction.editReply({ content: '⚠️ 查詢颱風資訊時發生錯誤，請稍後再試。' });
      }
    }
  },
};