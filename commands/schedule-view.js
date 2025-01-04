import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('schedule-view')
        .setDescription('View a user\'s schedule')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to view schedule for (optional)')),

    async execute(interaction, dbclient) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        try {
            const results = await dbclient.execute(
                `SELECT day, startTime, endTime FROM schedule
                 WHERE userId = ? ORDER BY day`,
                [targetUser.id]
            );

            if (!results || results.rows.length === 0) {
                await interaction.reply(`No schedule found for ${targetUser.username}.`);
                return;
            }

            let scheduleText = `Schedule for ${targetUser.username}:\n`;
            results.rows.forEach((row) => {
                scheduleText += `• ${row.day}: ${row.startTime}-${row.endTime}\n`;
            });

            await interaction.reply(scheduleText);
        } catch (err) {
            console.error('Error retrieving schedule:', err);
            await interaction.reply({ content: 'Failed to retrieve schedule.', ephemeral: true });
        }
    },
};
  