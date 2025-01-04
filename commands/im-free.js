import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('im-free')
        .setDescription('Add a time slot when you\'re free to hang out')
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
        let [startTime, endTime] = timeRange.split('-');

        // Normalize time format (convert to uppercase)
        startTime = startTime.toUpperCase();
        endTime = endTime.toUpperCase();

        // Validate time format
        const timeFormat = /^(1[0-2]|0?[1-9])(AM|PM)$/i;
        if (!startTime.match(timeFormat) || !endTime.match(timeFormat)) {
            await interaction.reply({
                content: 'Invalid time format. Please use format like: 8AM-10PM',
                ephemeral: true
            });
            return;
        }

        // Convert times to 24-hour format for comparison
        function convertTo24Hour(time) {
            const [_, hours, period] = time.match(/^(1[0-2]|0?[1-9])(AM|PM)$/i);
            let hour = parseInt(hours);
            
            if (period.toUpperCase() === 'PM' && hour !== 12) {
                hour += 12;
            } else if (period.toUpperCase() === 'AM' && hour === 12) {
                hour = 0;
            }
            
            return hour;
        }

        const start24 = convertTo24Hour(startTime);
        const end24 = convertTo24Hour(endTime);

        try {
            // Check for conflicts using 24-hour format
            const conflicts = await dbclient.execute(
                `WITH time_conversion AS (
                    SELECT 
                        CASE 
                            WHEN UPPER(startTime) LIKE '%PM' AND SUBSTR(startTime, 1, 2) != '12' 
                                THEN CAST(SUBSTR(startTime, 1, LENGTH(startTime)-2) AS INTEGER) + 12
                            WHEN UPPER(startTime) LIKE '%AM' AND SUBSTR(startTime, 1, 2) = '12'
                                THEN 0
                            ELSE CAST(SUBSTR(startTime, 1, LENGTH(startTime)-2) AS INTEGER)
                        END as start_hour,
                        CASE 
                            WHEN UPPER(endTime) LIKE '%PM' AND SUBSTR(endTime, 1, 2) != '12'
                                THEN CAST(SUBSTR(endTime, 1, LENGTH(endTime)-2) AS INTEGER) + 12
                            WHEN UPPER(endTime) LIKE '%AM' AND SUBSTR(endTime, 1, 2) = '12'
                                THEN 0
                            ELSE CAST(SUBSTR(endTime, 1, LENGTH(endTime)-2) AS INTEGER)
                        END as end_hour,
                        startTime,
                        endTime,
                        isFree
                    FROM schedule
                    WHERE userId = ? AND day = ?
                )
                SELECT startTime, endTime, isFree
                FROM time_conversion
                WHERE NOT (
                    end_hour <= ? OR start_hour >= ?
                )`,
                [
                    interaction.user.id,
                    day,
                    start24,
                    end24
                ]
            );

            if (conflicts.rows.length > 0) {
                const busyTimes = conflicts.rows
                    .filter(row => !row.isFree)
                    .map(row => `${row.startTime}-${row.endTime}`)
                    .join(', ');
                
                if (busyTimes) {
                    await interaction.reply({
                        content: `You can't be free during this time! You have busy events scheduled during: ${busyTimes}`,
                        ephemeral: true
                    });
                    return;
                }

                // If we only found overlapping free times, that's okay - we'll just add another one
            }

            // If no conflicts with busy times, insert the new free time
            await dbclient.execute(
                `INSERT INTO schedule (userId, day, startTime, endTime, isFree) 
                 VALUES (?, ?, ?, ?, TRUE)`,
                [interaction.user.id, day, startTime, endTime]
            );
            
            await interaction.reply({
                content: `🎉 Added free time for ${day}, ${startTime}-${endTime}! Your friends will know you're available to hang out!`,
                ephemeral: false  // Make this visible to everyone so friends can see
            });
        } catch (err) {
            console.error('Error handling schedule:', err);
            await interaction.reply({ 
                content: 'Failed to process schedule.', 
                ephemeral: true 
            });
        }
    },
}; 