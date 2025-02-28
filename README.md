# Scheduly Bot

## Description
Scheduly Bot is a Discord bot designed to help users manage and coordinate their schedules. It allows users to add course schedules, mark free time slots, view their own schedule, and compare schedules with other users to find common free time. The bot is particularly useful for students, study groups, or project teams who need to coordinate meeting times.

## Features
- **Add courses to schedule**: Add course schedules with day, time range, and course name
- **Mark free time**: Mark times when you're available for meetings or group activities
- **View schedule**: View your own schedule or another user's schedule
- **Compare schedules**: Compare your schedule with other users to find common free time
- **Schedule recommendations**: Get AI-powered recommendations for activities based on your schedule
- **User timezone support**: Manage schedules across different timezones

## Technology Stack
- Node.js
- Discord.js - For Discord bot functionality
- Turso (LibSQL) - Database for storing user schedules
- Llama 405b - For AI-powered recommendations
- Canvas - For schedule visualization

## Installation

### Prerequisites
- Node.js
- Discord Developer Application and Bot Token
- Turso Database
- Galadriel or OpenAI API Key (for AI recommendations)

### Setup
1. Clone the repository
   ```
   git clone https://github.com/kamrultarafder/scheduly-bot.git
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example` with the following variables:
   ```
   DISCORD_BOT_TOKEN=your_discord_token
   CLIENT_ID=your_client_id
   TURSO_DB_URL=your_turso_db_url
   TURSO_AUTH_TOKEN=your_turso_auth_token
   OPENAI_API_KEY=your_openai_api_key
   ```
4. Start the bot:
   ```
   npm start
   ```

## Discord Commands
- `/add` - Add a course to your schedule
- `/im-free` - Mark a time slot as free
- `/view` - View your schedule or another user's schedule
- `/compare` - Compare your schedule with another user
- `/rec` - Get AI recommendations based on your schedule
- `/clear` - Clear your entire schedule
- `/delete` - Delete a specific schedule entry
- `/change-name` - Change your display name
- `/help` - View bot help and command information

## Development
Run in development mode with auto-restart on file changes:
```
npm run dev
```
