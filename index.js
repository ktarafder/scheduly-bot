import { Client, GatewayIntentBits } from 'discord.js';
import { createClient } from "@libsql/client";
import 'dotenv/config';

const dbclient = createClient({
    url: process.env.TURSO_DB_URL,
    syncUrl: process.env.SYNC_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

if (dbclient) {
  console.log("Connected to the database");
}

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

(async () => {
    try {
      await dbclient.execute(`
        CREATE TABLE IF NOT EXISTS schedule (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT NOT NULL,
          day TEXT NOT NULL,
          startTime TEXT NOT NULL,
          endTime TEXT NOT NULL
        );
      `);
      console.log("Table 'schedule' created/exists.");
    } catch (err) {
      console.error("Error creating table:", err);
    }
  })();
  

// Replace with your bot's token
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// When the bot is ready, run this code
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Listen for messages
client.on('messageCreate', (message) => {
  // Prevent the bot from responding to itself
  if (message.author.bot) return;

  // Simple ping-pong command
  if (message.content === '!ping') {
    message.channel.send('Pong!');
  }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
  
    // e.g. "!schedule add Monday 8AM-10AM"
    if (message.content.startsWith('!schedule add')) {
      const args = message.content.split(' ');
      // args[0] = "!schedule", args[1] = "add", args[2] = "Monday", args[3] = "8AM-10AM"
      if (args.length < 4) {
        message.channel.send('Usage: !schedule add <day> <startTime-endTime>');
        return;
      }
  
      const day = args[2];
      const timeRange = args[3];
      const [startTime, endTime] = timeRange.split('-');
      if (!startTime || !endTime) {
        message.channel.send('Invalid time range. Example: 8AM-10AM');
        return;
      }
  
      try {
        await dbclient.execute(
          `INSERT INTO schedule (userId, day, startTime, endTime)
           VALUES (?, ?, ?, ?)`,
          [message.author.id, day, startTime, endTime]
        );
        message.channel.send(`Schedule saved for ${day}, ${startTime}-${endTime}`);
      } catch (err) {
        console.error("Error inserting schedule:", err);
        message.channel.send('Failed to save schedule.');
      }
    }
    
    // Simple ping-pong command
    if (message.content === '!ping') {
      message.channel.send('Pong!');
    }

    if (message.content.startsWith('!schedule view')) {
        // let userId = message.author.id by default
        let userId = message.author.id;
      
        // If there's a mention, set userId to that mention
        if (message.mentions.users.size > 0) {
          userId = message.mentions.users.first().id;
        }
      
        try {
          const results = await dbclient.execute(
            `SELECT day, startTime, endTime FROM schedule
             WHERE userId = ? ORDER BY day`,
            [userId]
          );
      
          if (!results || results.rows.length === 0) {
            message.channel.send('No schedule found.');
            return;
          }
      
          // Format the results
          let scheduleText = 'Schedule:\n';
          results.rows.forEach((row) => {
            scheduleText += `• ${row.day}: ${row.startTime}-${row.endTime}\n`;
          });
      
          message.channel.send(scheduleText);
        } catch (err) {
          console.error("Error retrieving schedule:", err);
          message.channel.send('Failed to retrieve schedule.');
        }
      }   
  });
  

// Log in to Discord
client.login(DISCORD_BOT_TOKEN);
