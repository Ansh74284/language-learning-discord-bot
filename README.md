# Language Learning Discord Bot

This Discord bot helps users learn languages through various features like translation, quizzes, daily challenges, and flashcards.

## Deployment on Render

1. Fork this repository to your GitHub account.
2. Create a new Web Service on Render.
3. Connect your GitHub repository to Render.
4. Use the following settings:
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add the following environment variables:
   - `DISCORD_TOKEN`: Your Discord bot token
   - `TRANSLATION_API_KEY`: Your translation API key
6. Click "Create Web Service"

## Local Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with the following variables:
   ````
   DISCORD_TOKEN=your_discord_bot_token
   TRANSLATION_API_KEY=your_translation_api_key
   ````
4. Run the bot: `npm start`

## Features

- Translation
- Language quizzes
- Daily challenges
- Flashcards

## Deployment

This bot is ready to be deployed on Heroku or similar platforms.
