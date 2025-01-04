import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { createClient } from "@libsql/client";

// Resolve the directory of the current module in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); 

// Turso connection
const dbclient = createClient({
    url: process.env.TURSO_DB_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

if (dbclient) {
  console.log("Connected to the database");
}

// Create a new discord client instance
const discord_client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Create schedule table if it doesn't exist
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

// Load all command files
const commandsFolder = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsFolder).filter(file => file.endsWith('.js'));

// Create a collection to store all commands
discord_client.commands = new Map();
const commands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsFolder, file);
    // ESM dynamic import
    const commandModule = await import(`file://${filePath}`);
    // The default export is the command data
    const command = commandModule.default;
    // Store in a map => key: command.name and in JSON format for slash command registration
    // Store commands for slash command registration
    if (command.data) {
      commands.push(command.data.toJSON());
      discord_client.commands.set(command.data.name, command);
  }
}

// Register slash commands
const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

try {
  console.log('Started refreshing application (/) commands.');

  await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
  );

  console.log('Successfully reloaded application (/) commands.');
} catch (error) {
  console.error(error);
}

// Add interaction handler
discord_client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = discord_client.commands.get(interaction.commandName);

  if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
  }

  try {
      await command.execute(interaction, dbclient);
  } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
      } else {
          await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
      }
  }
});

console.log(`Loaded ${discord_client.commands.size} commands:`);
discord_client.commands.forEach((value, key) => {
    console.log(`${key}: ${JSON.stringify(value)}`);
});
    
  
// Bot ready handler
discord_client.once('ready', () => {
  console.log(`Logged in as ${discord_client.user.tag}!`);
});


// Message command handler
discord_client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    // e.g. "!schedule add" => commandName="schedule add"
    const fullCommand = message.content.slice(1).trim();
    const args = fullCommand.split(/\s+/);
    const commandName = args.slice(0, 2).join(' ').toLowerCase();
    const remainingArgs = args.slice(2);
    console.log(`Command: ${commandName}, Args: ${remainingArgs}`);
    const command = discord_client.commands.get(commandName);

  if (!command) return;

  if (commandName === 'schedule view') {
    try {
        await command.execute(message, dbclient);
    } catch (error) {
        console.error(error);
    }
  } else {
    try {
        // Pass in your database client, message, and args
        await command.execute(message, args, dbclient);
      } catch (error) {
        console.error(error);
      }
}
});

// Log in to Discord
discord_client.login(process.env.DISCORD_BOT_TOKEN);
