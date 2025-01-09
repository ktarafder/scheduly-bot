import { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear all events and free time slots from your schedule'),

    async execute(interaction, dbclient) {
        try {
            const userId = interaction.user.id;

            // Create confirmation buttons
            const yesButton = new ButtonBuilder()
                .setCustomId('confirm_clear')
                .setLabel('Yes')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('✅');

            const noButton = new ButtonBuilder()
                .setCustomId('cancel_clear')
                .setLabel('No')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌');

            const buttonRow = new ActionRowBuilder().addComponents(yesButton, noButton);

            // Send the confirmation message
            await interaction.reply({
                content: "⚠️ WARNING: This command removes all events and free time slots from your schedule. This action is NOT reversible. Are you sure you want to clear everything from your schedule?",
                components: [buttonRow],
                flags: MessageFlags.Ephemeral
            });

            // Create a message component collector
            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 30000 // Timeout after 30 seconds
            });

            collector.on('collect', async i => {
                if (i.customId === 'confirm_clear') {
                    // Delete all entries for the user
                    await dbclient.execute(`
                        DELETE FROM schedules
                        WHERE userId = ?
                    `, [userId]);

                    await i.update({
                        content: 'All events and free time slots have been cleared from your schedule.',
                        components: [],
                        flags: MessageFlags.Ephemeral
                    });
                    collector.stop();
                } else if (i.customId === 'cancel_clear') {
                    await i.update({
                        content: 'Operation cancelled. No changes were made to your schedule.',
                        components: [],
                        flags: MessageFlags.Ephemeral
                    });
                    collector.stop();
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    try {
                        await interaction.editReply({
                            content: 'Time expired. Please run the command again if you wish to clear your schedule.',
                            components: [],
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (err) {
                        console.error('Error updating expired message:', err);
                    }
                }
            });

        } catch (err) {
            console.error('Error clearing schedule:', err);
            await interaction.reply({
                content: 'Failed to clear your schedule. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};