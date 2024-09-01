require('dotenv').config();
const { Client, Intents } = require('discord.js');
const axios = require('axios');
const fs = require('fs').promises;
const winston = require('winston');
const express = require('express');

const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});

client.commands = new Map();

async function loadCommands() {
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
    // ... rest of your command loading logic
}

// Call this function where appropriate
loadCommands().catch(console.error);

client.once('ready', () => {
    console.log('Bot is Online!');
});

const PORT = process.env.PORT || 3000;
client.login(process.env.DISCORD_TOKEN);

// Optional: Add a simple web server to keep the bot alive on some hosting platforms
const app = express();

app.get('/', (req, res) => {
    res.send('Language Learning Bot is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

client.on('messageCreate', async message => {
    if (!message.content.startsWith('!') || message.author.bot) return;

    const args = message.content.slice(1).split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (!client.commands.has(commandName)) return;

    try {
        await client.commands.get(commandName).execute(message, args);
    } catch (error) {
        console.error(error);
        await message.reply('There was an error executing that command.');
    }
});

// Add error handling for API key
if (!process.env.TRANSLATION_API_KEY) {
    console.error('Translation API key is missing. Please set TRANSLATION_API_KEY in your .env file.');
    process.exit(1);
}

// Add error handling for Discord connection
client.on('error', error => {
    console.error('Discord client error:', error);
});

console.log('Bot is ready to translate!');

// Implement rate limiting (example)
const commandCooldowns = new Map();

function checkRateLimit(userId, commandName, cooldownTime) {
    if (!commandCooldowns.has(userId)) {
        commandCooldowns.set(userId, new Map());
    }

    const userCooldowns = commandCooldowns.get(userId);
    const now = Date.now();

    if (userCooldowns.has(commandName)) {
        const expirationTime = userCooldowns.get(commandName) + cooldownTime;
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return `Please wait ${timeLeft.toFixed(1)} more seconds before using this command again.`;
        }
    }

    userCooldowns.set(commandName, now);
    return null;
}

// Update help command (single implementation)
client.on('messageCreate', async message => {
    if (message.content.toLowerCase() === '!help') {
        const helpMessage = `
Here are the available commands:
!translate <source_language> <target_language> <text> - Translates the given text from the source language to the target language
!quiz <source_language> <target_language> - Starts a vocabulary quiz for the given language pair
!dailychallenge - Starts a new daily translation challenge
!answer <your_translation> - Submit your answer for the daily challenge
!flashcards <source_language> <target_language> [number_of_cards] - Creates flashcards for language learning
!help - Shows this help message

Example: !translate en fr Hello, how are you?
Example: !quiz en fr
Example: !dailychallenge
Example: !answer bonjour
Example: !flashcards en fr 10
        `.trim();
        await message.reply(helpMessage);   
    }
});

// Add a flashcards command
client.on('messageCreate', async message => {
    if (message.content.toLowerCase().startsWith('!flashcards')) {
        const args = message.content.slice(11).trim().split(/ +/);
        const sourceLang = args[0];
        const targetLang = args[1];
        const count = parseInt(args[2]) || 5; // Default to 5 flashcards if not specified

        if (!sourceLang || !targetLang) {
            return message.reply('Usage: !flashcards <source_language> <target_language> [number_of_cards]');
        }

        try {
            // Generate random words in the source language
            const response = await axios.get(`https://random-word-api.herokuapp.com/word?lang=${sourceLang}&number=${count}`);
            const words = response.data;

            // Create flashcards
            const flashcards = [];
            for (const word of words) {
                const translationResponse = await axios.get(`https://translation-api.reverso.net/getglossary`, {
                    params: {
                        key: process.env.TRANSLATION_API_KEY,
                        text: word,
                        langpair: `${sourceLang}|${targetLang}`
                    }
                });
                const translatedWord = translationResponse.data.translation;
                flashcards.push({ front: word, back: translatedWord });
            }

            // Send flashcards to the user
            await message.reply(`Here are your ${count} flashcards:`);
            for (let i = 0; i < flashcards.length; i++) {
                await message.channel.send(`Card ${i + 1}:\nFront (${sourceLang}): ${flashcards[i].front}\nBack (${targetLang}): ||${flashcards[i].back}||`);
            }

        } catch (error) {
            console.error('Error in flashcards command:', error);
            await message.reply('An error occurred while creating flashcards. Please try again later.');
        }
    }
});

// Daily Challenge command
client.on('messageCreate', async message => {
    if (message.content.toLowerCase().startsWith('!dailychallenge')) {
        try {
            // Get random language pair
            const languages = ['en', 'fr', 'es', 'de', 'it']; // Add more languages as needed
            const sourceLang = languages[Math.floor(Math.random() * languages.length)];
            let targetLang;
            do {
                targetLang = languages[Math.floor(Math.random() * languages.length)];
            } while (targetLang === sourceLang);

            // Get a random word
            const response = await axios.get(`https://random-word-api.herokuapp.com/word?lang=${sourceLang}`);
            const word = response.data[0];

            // Translate the word
            const translationResponse = await axios.get(`https://translation-api.reverso.net/getglossary`, {
                params: {
                    key: process.env.TRANSLATION_API_KEY,
                    text: word,
                    langpair: `${sourceLang}|${targetLang}`
                }
            });
            const translatedWord = translationResponse.data.translation;

            // Store the challenge
            const challenge = {
                word: word,
                sourceLang: sourceLang,
                targetLang: targetLang,
                translation: translatedWord,
                participants: []
            };

            // Save the challenge to a file
            await saveDailyChallenge(challenge);

            // Send the challenge
            await message.channel.send(`Daily Challenge: Translate "${word}" from ${sourceLang} to ${targetLang}. Use !answer <your_translation> to submit your answer!`);

            // Listen for answers
            const filter = m => m.content.toLowerCase().startsWith('!answer');
            const collector = message.channel.createMessageCollector({ filter, time: 24 * 60 * 60 * 1000 }); // 24 hours

            collector.on('collect', async m => {
                const answer = m.content.split(' ').slice(1).join(' ').toLowerCase();
                if (!challenge.participants.includes(m.author.id)) {
                    if (answer === translatedWord.toLowerCase()) {
                        await m.reply('Correct! You\'ve completed today\'s challenge!');
                        challenge.participants.push(m.author.id);
                    } else {
                        await m.reply('Sorry, that\'s not correct. Try again!');
                    }
                } else {
                    await m.reply('You\'ve already completed today\'s challenge!');
                }
            });

            collector.on('end', async collected => {
                await message.channel.send(`The daily challenge has ended. ${challenge.participants.length} user(s) completed it successfully!`);
            });

        } catch (error) {
            console.error('Error in daily challenge command:', error);
            await message.reply('An error occurred while creating the daily challenge. Please try again later.');
        }
    }
});

// Add a quiz command
client.on('messageCreate', async message => {
    if (message.content.toLowerCase().startsWith('!quiz')) {
        const args = message.content.slice(6).trim().split(/ +/);
        const sourceLang = args[0];
        const targetLang = args[1];

        if (!sourceLang || !targetLang) {
            return message.reply('Usage: !quiz <source_language> <target_language>');
        }

        try {
            // Generate a random word in the source language
            const response = await axios.get(`https://random-word-api.herokuapp.com/word?lang=${sourceLang}`);
            const word = response.data[0];

            // Translate the word to the target language
            const translationResponse = await axios.get(`https://translation-api.reverso.net/getglossary`, {
                params: {
                    key: process.env.TRANSLATION_API_KEY,
                    text: word,
                    langpair: `${sourceLang}|${targetLang}`
                }
            });
            const translatedWord = translationResponse.data.translation;

            // Send the quiz question
            await message.reply(`Translate this word from ${sourceLang} to ${targetLang}: ${word}`);

            // Wait for the user's answer
            const filter = m => m.author.id === message.author.id;
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
            const answer = collected.first().content.toLowerCase();

            // Check the answer
            if (answer === translatedWord.toLowerCase()) {
                await message.reply('Correct! Well done!');
            } else {
                await message.reply(`Sorry, that's incorrect. The correct translation is: ${translatedWord}`);
            }
        } catch (error) {
            console.error('Error in quiz command:', error);
            await message.reply('An error occurred while creating the quiz. Please try again later.');
        }
    }
});

// Implement error logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'language-bot' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

// Use logger.error() instead of console.error() for better error tracking






