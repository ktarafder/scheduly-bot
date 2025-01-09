import { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('change-name')
        .setDescription('Change your name in the schedule system')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Your new name')
                .setRequired(true)),

    async execute(interaction, dbclient) {
        const userId = interaction.user.id;
        const newName = interaction.options.getString('name');

        try {
            // Get current name
            const result = await dbclient.execute(
                'SELECT name FROM users WHERE user_id = ?',
                [userId]
            );

            const currentName = result.rows[0]?.name || interaction.user.username;

            // Create confirmation buttons
            const confirm = new ButtonBuilder()
                .setCustomId('confirm')
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success);

            const cancel = new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder()
                .addComponents(confirm, cancel);

            // Send confirmation message
            const response = await interaction.reply({
                content: `Do you want to change your name from "${currentName}" to "${newName}"?`,
                components: [row],
                flags: MessageFlags.Ephemeral
            });

            // Create button collector
            const collector = response.createMessageComponentCollector({ time: 15000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'These buttons aren\'t for you!', flags: MessageFlags.Ephemeral });
                    return;
                }

                if (i.customId === 'confirm') {
                    try {
                        await dbclient.execute(
                            'INSERT INTO users (user_id, name) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET name = ?',
                            [userId, newName, newName]
                        );

                        await i.update({
                            content: `Your name has been changed to "${newName}"!`,
                            components: []
                        });
                    } catch (error) {
                        console.error('Database error:', error);
                        await i.update({
                            content: 'Failed to update your name. Please try again later.',
                            components: []
                        });
                    }
                } else {
                    await i.update({
                        content: 'Name change cancelled.',
                        components: []
                    });
                }
            });

            collector.on('end', async collected => {
                if (collected.size === 0) {
                    await interaction.editReply({
                        content: 'Name change timed out.',
                        components: []
                    });
                }
            });

        } catch (error) {
            console.error('Error:', error);
            await interaction.reply({
                content: 'An error occurred while processing your request.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};