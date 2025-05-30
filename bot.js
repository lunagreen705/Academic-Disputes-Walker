const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config.js");
const fs = require("fs");
const path = require('path');
const { initializePlayer } = require('./player');
const { connectToDatabase } = require('./mongodb');
const colors = require('./UI/colors/colors');
// --- FIX START: Correct way to import GoogleGenerativeAI for the @google/genai package ---
const { GoogleGenerativeAI } = require("@google/genai"); 
// --- FIX END ---
require('dotenv').config();

// --- Gemini AI Configuration ---
const MODEL_NAME = "gemini-flash"; // Or "gemini-pro", depending on your needs
// --- FIX START: Correct way to initialize GoogleGenerativeAI ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); 
// --- FIX END ---

const client = new Client({
    // Explicitly list required Intents for better performance and security
    intents: [
        GatewayIntentBits.Guilds,           // For server-related events (e.g., joining/leaving guilds, channel creation)
        GatewayIntentBits.GuildMessages,    // For receiving messages in guilds
        GatewayIntentBits.MessageContent,   // IMPORTANT: To read actual message content (needed for AI responses and command processing)
        GatewayIntentBits.GuildVoiceStates, // For music bot's voice channel state updates
        // Add other Intents if your bot needs more features (e.g., fetching member lists, or handling DMs):
        // GatewayIntentBits.GuildMembers,   // PRIVILEGED INTENT: For fetching guild member information (must be enabled in Discord Developer Portal)
        // GatewayIntentBits.DirectMessages, // For receiving direct messages
    ],
});

client.config = config; // Set bot configuration
initializePlayer(client); // Initialize the music player

client.on("ready", async () => {
    console.log(`${colors.cyan}[ SYSTEM ]${colors.reset} ${colors.green}Client logged as ${colors.yellow}${client.user.tag}${colors.reset}`);
    console.log(`${colors.cyan}[ MUSIC ]${colors.reset} ${colors.green}Riffy Music System Ready 🎵${colors.reset}`);
    console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
    client.riffy.init(client.user.id);

    // --- Register Slash Commands ---
    // Make sure client.commands is populated in your command loading logic
    if (client.commands.length > 0) {
        try {
            await client.application.commands.set(client.commands);
            console.log(`${colors.cyan}[ COMMAND ]${colors.reset} ${colors.green}Successfully registered slash commands!${colors.reset}`);
        } catch (error) {
            console.error(`${colors.red}[ ERROR ]${colors.reset} ${colors.red}Failed to register slash commands: ${error.message}${colors.reset}`);
        }
    } else {
        console.log(`${colors.cyan}[ COMMAND ]${colors.reset} ${colors.yellow}No slash commands found to register.${colors.reset}`);
    }
    // --- End Slash Command Registration ---
});

// --- Gemini AI Message Handling ---
client.on("messageCreate", async (message) => {
    // Ignore messages from bots to prevent infinite loops
    if (message.author.bot) return;

    // Trigger when the bot is @mentioned
    if (message.mentions.has(client.user)) {
        // Remove bot mention from message content and trim whitespace
        const userMessage = message.content
            .replace(`<@!${client.user.id}>`, "") // Handle <@!ID> mention format
            .replace(`<@${client.user.id}>`, "")   // Handle <@ID> mention format
            .trim();

        // If message content is empty after removing mention, prompt user
        if (userMessage.length === 0) {
            await message.reply("Hmm? Do you need help? Please type your question after mentioning me.");
            return;
        }

        // Send "typing..." status for better user experience
        await message.channel.sendTyping();

        try {
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });

            const generationConfig = {
                temperature: 0.9,      // 0.0-1.0, higher values make responses more creative/random
                topK: 40,              // Recommended: Consider top K most probable tokens (usually better than 1 for diversity)
                topP: 0.9,             // Recommended: Nucleus sampling, consider tokens with cumulative probability P (usually better than 1 for diversity)
                maxOutputTokens: 2048, // Maximum number of output tokens
            };

            // Pass message to Gemini model as "user" role
            const parts = [{
                role: "user",
                text: userMessage,
            }];

            const result = await model.generateContent({
                contents: [{ role: "user", parts }],
                generationConfig,
            });

            const reply = await result.response.text();

            // Split long messages due to Discord's 2000 character limit
            if (reply.length > 2000) {
                const replyArray = reply.match(/[\s\S]{1,1999}/g); // Ensure each chunk is slightly less than 2000
                for (const msg of replyArray) { // Use for...of to ensure sequential sending
                    await message.reply(msg);
                }
            } else {
                await message.reply(reply);
            }
        } catch (error) {
            console.error(`${colors.red}[ AI ERROR ]${colors.reset} Error generating content:`, error);
            await message.reply("Sorry, I can't process your request right now. Please try again later.");
        }
    }
});
// --- End Gemini AI Message Handling ---

// Read and register event handlers (e.g., 'messageCreate', 'interactionCreate')
fs.readdir("./events", (_err, files) => {
    files.forEach((file) => {
        if (!file.endsWith(".js")) return;
        const event = require(`./events/${file}`);
        let eventName = file.split(".")[0];
        client.on(eventName, event.bind(null, client));
        delete require.cache[require.resolve(`./events/${file}`)]; // Clear cache for hot reloading during development
    });
});

client.commands = []; // Initialize array to store slash command info
// Read and load slash commands (these commands will be registered to Discord API in 'ready' event)
fs.readdir(config.commandsDir, (err, files) => {
    if (err) {
        console.error(`${colors.red}[ ERROR ]${colors.reset} ${colors.red}Failed to read commands directory: ${err.message}${colors.reset}`);
        return;
    }
    files.forEach(async (f) => {
        try {
            if (f.endsWith(".js")) {
                let props = require(`${config.commandsDir}/${f}`);
                client.commands.push({
                    name: props.name,
                    description: props.description,
                    options: props.options,
                });
                console.log(`${colors.cyan}[ COMMAND ]${colors.reset} ${colors.green}Loaded command: ${colors.yellow}${props.name}${colors.reset}`);
            }
        } catch (err) {
            console.error(`${colors.red}[ ERROR ]${colors.reset} ${colors.red}Failed to load command ${f}: ${err.message}${colors.reset}`);
        }
    });
});

// Handle raw Discord Gateway events (primarily for Riffy's voice state updates)
client.on("raw", (d) => {
    const { GatewayDispatchEvents } = require("discord.js"); // Local import to avoid global pollution
    if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
    client.riffy.updateVoiceState(d);
});

// Log in Discord bot
client.login(config.TOKEN || process.env.TOKEN).catch((e) => {
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🔐 TOKEN VERIFICATION${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ TOKEN ]${colors.reset} ${colors.red}Authentication Failed ❌${colors.reset}`);
    console.log(`${colors.gray}Error: ${e.message}. Please turn on necessary Intents or reset to a new Token.${colors.reset}`); // More explicit error message
});

// Connect to MongoDB database
connectToDatabase().then(() => {
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE STATUS${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.green}MongoDB Online ✅${colors.reset}`);
}).catch((err) => {
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE STATUS${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.red}Connection Failed ❌${colors.reset}`);
    console.log(`${colors.gray}Error: ${err.message}${colors.reset}`);
});

// Set up a simple Express Web server
const express = require("express");
const app = express();
const port = 3000;
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'index.html'); // Assumes index.html is in the bot's main directory
    res.sendFile(filePath);
});

app.listen(port, () => {
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🌐 SERVER STATUS${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ SERVER ]${colors.reset} ${colors.green}Online ✅${colors.reset}`);
    console.log(`${colors.cyan}[ PORT ]${colors.reset} ${colors.yellow}http://localhost:${port}${colors.reset}`);
    console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
    console.log(`${colors.cyan}[ USER ]${colors.reset} ${colors.yellow}GlaceYT${colors.reset}`);
});
