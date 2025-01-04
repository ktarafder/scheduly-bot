import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add a busy time slot to your schedule')
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
                .setDescription('Time range (format: 8am-10am)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('course')
                .setDescription('Course name (optional)')
                .setRequired(false)),

    async execute(interaction, dbclient) {
        const day = interaction.options.getString('day');
        const timeRange = interaction.options.getString('timerange');
        const courseName = interaction.options.getString('course');
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
                        endTime
                    FROM schedule
                    WHERE userId = ? AND day = ?
                )
                SELECT startTime, endTime
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
                const conflictTimes = conflicts.rows
                    .map(row => `${row.startTime}-${row.endTime}`)
                    .join(', ');
                await interaction.reply({
                    content: `Conflicting events found! You already have events scheduled during: ${conflictTimes}`,
                    ephemeral: true
                });
                return;
            }

            // Insert schedule data into schedule table
            await dbclient.execute(
                `INSERT INTO schedule (userId, day, startTime, endTime, isFree, courseName) 
                 VALUES (?, ?, ?, ?, FALSE, ?)`,
                [interaction.user.id, day, startTime, endTime, courseName]
            );
            
            // Updated reply to include course name if provided
            const replyMessage = courseName 
                ? `Added busy time slot for ${day}, ${startTime}-${endTime} (${courseName})`
                : `Added busy time slot for ${day}, ${startTime}-${endTime}`;
            
            await interaction.reply({
                content: replyMessage,
                ephemeral: true
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
  