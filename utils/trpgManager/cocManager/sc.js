// sc.js
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

// 載入症狀資料
const dataPath = path.join(__dirname, '../../../data/trpg/coc/症狀.json');
const symptomData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 取得隨機項目
function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// 抽一個症狀（類型：'即時症狀'、'總結症狀'、'恐懼症狀'、'狂躁症狀'）
function drawSymptom(type) {
    if (!symptomData[type]) {
        return null;
    }
    return getRandomItem(symptomData[type]);
}

// 美化嵌入產生器
function createSymptomEmbed(title, emoji, symptomText, color) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} ${title}`)
        .setDescription(symptomText)
        .setTimestamp()
        .setFooter({ text: '症狀驚喜包' });
}

// 指令處理介面（返回 EmbedBuilder 實例）
function handleTICommand() {
    const result = drawSymptom('即時症狀');
    if (!result) {
        return createSymptomEmbed('錯誤', '⚠️', '無法取得「即時症狀」資料。', '#FF0000');
    }
    return createSymptomEmbed('即時症狀', '🎭', result, '#FFA500'); // 橘色
}

function handleLICommand() {
    const result = drawSymptom('總結症狀');
    if (!result) {
        return createSymptomEmbed('錯誤', '⚠️', '無法取得「總結症狀」資料。', '#FF0000');
    }
    return createSymptomEmbed('總結症狀', '🧠', result, '#1E90FF'); // 道奇藍
}

function handlePhobiaCommand() {
    const result = drawSymptom('恐懼症狀');
    if (!result) {
        return createSymptomEmbed('錯誤', '⚠️', '無法取得「恐懼症狀」資料。', '#FF0000');
    }
    return createSymptomEmbed('恐懼症狀', '😱', result, '#8B0000'); // 深紅
}

function handleManiaCommand() {
    const result = drawSymptom('狂躁症狀');
    if (!result) {
        return createSymptomEmbed('錯誤', '⚠️', '無法取得「狂躁症狀」資料。', '#FF0000');
    }
    return createSymptomEmbed('狂躁症狀', '🤪', result, '#9400D3'); // 紫羅蘭
}

module.exports = {
    drawSymptom,
    handleTICommand,
    handleLICommand,
    handlePhobiaCommand,
    handleManiaCommand
};
