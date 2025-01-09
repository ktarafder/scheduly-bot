import { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('delete')
        .setDescription('Delete events from your schedule'),

    async execute(interaction, dbclient) {
        try {
            const userId = interaction.user.id;

            // Fetch all events (non-free time slots) for the user
            const events = await dbclient.execute(`
                SELECT id, day, start_time, end_time, course_name
                FROM schedules
                WHERE userId = ? 
                AND is_free = FALSE
                ORDER BY 
                    CASE day
                        WHEN 'Monday' THEN 1
                        WHEN 'Tuesday' THEN 2
                        WHEN 'Wednesday' THEN 3
                        WHEN 'Thursday' THEN 4
                        WHEN 'Friday' THEN 5
                    END,
                    start_time
            `, [userId]);

            if (!events || events.rows.length === 0) {
                await interaction.reply({
                    content: "You don't have any events to delete!",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Convert minutes to readable time
            const formatTime = (minutes) => {
                let hour = Math.floor(minutes / 60);
                const minute = minutes % 60;
                const period = hour >= 12 ? 'PM' : 'AM';
                if (hour > 12) hour -= 12;
                else if (hour === 0) hour = 12;
                return minute === 0
                    ? `${hour}${period}`
                    : `${hour}:${minute.toString().padStart(2, '0')}${period}`;
            };

            // Create select menu options
            const options = events.rows.map(event => {
                const timeRange = `${formatTime(event.start_time)}-${formatTime(event.end_time)}`;
                const label = event.course_name
                    ? `${event.day}: ${event.course_name}`
                    : `${event.day}: Busy`;
                const description = `Time: ${timeRange}`;

                return new StringSelectMenuOptionBuilder()
                    .setLabel(label)
                    .setDescription(description)
                    .setValue(event.id.toString());
            });

            // Create the select menu
            const select = new StringSelectMenuBuilder()
                .setCustomId('delete_events')
                .setPlaceholder('Select events to delete')
                .setMinValues(1)
                .setMaxValues(options.length)
                .addOptions(options);

            // Create confirm and cancel buttons
            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm_delete')
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_delete')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌');

            // Create action rows (dropdown and buttons)
            const selectRow = new ActionRowBuilder().addComponents(select);
            const buttonRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            // Send the message with the select menu and buttons
            await interaction.reply({
                content: 'Select the events you want to delete:',
                components: [selectRow, buttonRow],
                flags: MessageFlags.Ephemeral
            });

            let selectedEvents = [];
            let s = '';

            // Create a message component collector
            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 60000 // Timeout after 1 minute
            });

            collector.on('collect', async i => {
                try {
                    if (i.customId === 'delete_events') {
                        // Store the selected events
                        selectedEvents = i.values;
                        s = selectedEvents.length > 1 ? 's' : '';
                        await i.update({
                            content: `Selected ${selectedEvents.length} event${s} for deletion. Click Confirm to delete or Cancel to abort.`,
                            components: [selectRow, buttonRow],
                            flags: MessageFlags.Ephemeral
                        });
                    } 
                    else if (i.customId === 'confirm_delete' && selectedEvents.length > 0) {
                        // Delete the selected events
                        const placeholders = selectedEvents.map(() => '?').join(',');
                        await dbclient.execute(`
                            DELETE FROM schedules
                            WHERE id IN (${placeholders})
                            AND userId = ?
                        `, [...selectedEvents, userId]);

                        // Ask if they want to replace with free slots
                        const replaceButton = new ButtonBuilder()
                            .setCustomId('replace_with_free')
                            .setLabel(`Replace with Free Slot${s}`)
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🆓');

                        const noReplaceButton = new ButtonBuilder()
                            .setCustomId('no_replace')
                            .setLabel('No, Thanks')
                            .setStyle(ButtonStyle.Secondary);

                        const replaceRow = new ActionRowBuilder().addComponents(replaceButton, noReplaceButton);

                        await i.update({
                            content: `Successfully deleted ${selectedEvents.length} event${s}! Would you like to replace deleted time${s} with free slot${s}?`,
                            components: [replaceRow],
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    else if (i.customId === 'cancel_delete') {
                        await i.update({
                            content: 'Operation cancelled.',
                            components: [],
                            flags: MessageFlags.Ephemeral
                        });
                        collector.stop();
                    }
                    else if (i.customId === 'replace_with_free') {
                        // Insert free slots for the deleted events
                        const deletedEvents = events.rows.filter(event => selectedEvents.includes(event.id.toString()));
                        for (const event of deletedEvents) {
                            await dbclient.execute(`
                                INSERT INTO schedules (userId, day, start_time, end_time, is_free)
                                VALUES (?, ?, ?, ?, TRUE)
                            `, [userId, event.day, event.start_time, event.end_time]);
                        }

                        await i.update({
                            content: `Updated schedule with ${selectedEvents.length} free slot${s}.`,
                            components: [],
                            flags: MessageFlags.Ephemeral
                        });
                        collector.stop();
                    }
                    else if (i.customId === 'no_replace') {
                        await i.update({
                            content: `event${s} deleted, no free slot${s} added.`,
                            components: [],
                            flags: MessageFlags.Ephemeral
                        });
                        collector.stop();
                    }
                } catch (err) {
                    console.error('Error handling events:', err);
                    await i.update({
                        content: 'An error occurred. Please try again.',
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
                            content: 'Time expired. Please run the command again.',
                            components: [],
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (err) {
                        console.error('Error updating expired message:', err);
                    }
                }
            });

        } catch (err) {
            console.error('Error creating delete menu:', err);
            await interaction.reply({
                content: 'Failed to load events. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};