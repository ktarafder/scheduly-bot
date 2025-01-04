import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('schedule-add')
        .setDescription('Add a day/time range to user schedule')
        .addStringOption(option =>
            option.setName('day')
                .setDescription('Day of the week')
                .setRequired(true)
                .addChoices(
                    { name: 'Monday', value: 'Monday' },
                    { name: 'Tuesday', value: 'Tuesday' },
                    { name: 'Wednesday', value: 'Wednesday' },
                    { name: 'Thursday', value: 'Thursday' },
                    { name: 'Friday', value: 'Friday' },
                ))
        .addStringOption(option =>
            option.setName('timerange')
                .setDescription('Time range (format: 8AM-10AM)')
                .setRequired(true)),

    async execute(interaction, dbclient) {
        const day = interaction.options.getString('day');
        const timeRange = interaction.options.getString('timerange');
        const [startTime, endTime] = timeRange.split('-');

        if (!startTime || !endTime) {
            await interaction.reply('Invalid time range. Example: 8AM-10AM');
            return;
        }

        try {
            await dbclient.execute(
                `INSERT INTO schedule (userId, day, startTime, endTime) VALUES (?, ?, ?, ?)`,
                [interaction.user.id, day, startTime, endTime]
            );
            await interaction.reply(`Schedule saved for ${day}, ${startTime}-${endTime}`);
        } catch (err) {
            console.error('Error inserting schedule:', err);
            await interaction.reply({ content: 'Failed to save schedule.', ephemeral: true });
        }
    },
};
  