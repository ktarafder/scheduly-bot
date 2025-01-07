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
            const courseName = interaction.options.getString('course');
            let [startTime, endTime] = timeRange.split('-');
    
            // Normalize time format (convert to uppercase)
            startTime = startTime.toUpperCase();
            endTime = endTime.toUpperCase();
    
            // Updated regex for time format validation
            const timeFormatRegex = /^(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(AM|PM)$/i;
    
            if (!timeFormatRegex.test(startTime) || !timeFormatRegex.test(endTime)) {
                await interaction.reply({
                    content: 'Invalid time format. Please use format like "8AM-10AM" or "8:30AM-10:45AM"',
                    ephemeral: true
                });
                return;
            }
        
             // Parse times to standardized format
             const parseTime = (time) => {
                const match = time.match(timeFormatRegex);
                const hours = match[1];
                const minutes = match[2] || '00';
                const period = match[3];
                return `${hours}:${minutes}${period}`;
            };
    
            startTime = parseTime(startTime);
            endTime = parseTime(endTime);

                // Updated convertTo24Hour function with better error handling
        function convertTo24Hour(time) {
            const match = time.match(timeFormatRegex);
            if (!match) {
                throw new Error(`Invalid time format: ${time}`);
            }

            let [_, hours, minutes, period] = match;
            let hour = parseInt(hours);
            
            if (!period) {
                throw new Error(`Missing AM/PM indicator: ${time}`);
            }

            period = period.toUpperCase();
            if (period === 'PM' && hour !== 12) {
                hour += 12;
            } else if (period === 'AM' && hour === 12) {
                hour = 0;
            }
            
            const mins = minutes ? parseInt(minutes) : 0;
            return hour + (mins / 60);
        }

        try {
            const start24 = convertTo24Hour(startTime);
            const end24 = convertTo24Hour(endTime);

            // ...existing database query code...
        } catch (error) {
            await interaction.reply({
                content: `Error processing time: ${error.message}`,
                ephemeral: true
            });
            return;
        }
        const start24 = convertTo24Hour(startTime);
        const end24 = convertTo24Hour(endTime);

        try {
            const conflicts = await dbclient.execute(
                `WITH time_conversion AS (
                    SELECT 
                        id,
                        CASE 
                            WHEN UPPER(startTime) LIKE '%PM' AND CAST(
                                CASE 
                                    WHEN INSTR(startTime, ':') > 0 
                                    THEN SUBSTR(startTime, 1, INSTR(startTime, ':') - 1)
                                    ELSE SUBSTR(startTime, 1, LENGTH(startTime) - 2)
                                END AS INTEGER) != 12 
                            THEN CAST(
                                CASE 
                                    WHEN INSTR(startTime, ':') > 0 
                                    THEN SUBSTR(startTime, 1, INSTR(startTime, ':') - 1)
                                    ELSE SUBSTR(startTime, 1, LENGTH(startTime) - 2)
                                END AS INTEGER) + 12
                            WHEN UPPER(startTime) LIKE '%AM' AND CAST(
                                CASE 
                                    WHEN INSTR(startTime, ':') > 0 
                                    THEN SUBSTR(startTime, 1, INSTR(startTime, ':') - 1)
                                    ELSE SUBSTR(startTime, 1, LENGTH(startTime) - 2)
                                END AS INTEGER) = 12 
                            THEN 0
                            ELSE CAST(
                                CASE 
                                    WHEN INSTR(startTime, ':') > 0 
                                    THEN SUBSTR(startTime, 1, INSTR(startTime, ':') - 1)
                                    ELSE SUBSTR(startTime, 1, LENGTH(startTime) - 2)
                                END AS INTEGER)
                        END + 
                        CASE 
                            WHEN INSTR(startTime, ':') > 0 
                            THEN CAST(SUBSTR(startTime, INSTR(startTime, ':') + 1, 2) AS FLOAT) / 60
                            ELSE 0
                        END as start_hour,
                        CASE 
                            WHEN UPPER(endTime) LIKE '%PM' AND CAST(
                                CASE 
                                    WHEN INSTR(endTime, ':') > 0 
                                    THEN SUBSTR(endTime, 1, INSTR(endTime, ':') - 1)
                                    ELSE SUBSTR(endTime, 1, LENGTH(endTime) - 2)
                                END AS INTEGER) != 12 
                            THEN CAST(
                                CASE 
                                    WHEN INSTR(endTime, ':') > 0 
                                    THEN SUBSTR(endTime, 1, INSTR(endTime, ':') - 1)
                                    ELSE SUBSTR(endTime, 1, LENGTH(endTime) - 2)
                                END AS INTEGER) + 12
                            WHEN UPPER(endTime) LIKE '%AM' AND CAST(
                                CASE 
                                    WHEN INSTR(endTime, ':') > 0 
                                    THEN SUBSTR(endTime, 1, INSTR(endTime, ':') - 1)
                                    ELSE SUBSTR(endTime, 1, LENGTH(endTime) - 2)
                                END AS INTEGER) = 12 
                            THEN 0
                            ELSE CAST(
                                CASE 
                                    WHEN INSTR(endTime, ':') > 0 
                                    THEN SUBSTR(endTime, 1, INSTR(endTime, ':') - 1)
                                    ELSE SUBSTR(endTime, 1, LENGTH(endTime) - 2)
                                END AS INTEGER)
                        END + 
                        CASE 
                            WHEN INSTR(endTime, ':') > 0 
                            THEN CAST(SUBSTR(endTime, INSTR(endTime, ':') + 1, 2) AS FLOAT) / 60
                            ELSE 0
                        END as end_hour
                    FROM schedule
                    WHERE userId = ? AND day = ?
                )
                SELECT * FROM time_conversion 
                WHERE (? BETWEEN start_hour AND end_hour) 
                OR (? BETWEEN start_hour AND end_hour)
                OR (start_hour BETWEEN ? AND ?)`,
                [interaction.user.id, day, start24, end24, start24, end24]
            );

            if (conflicts.rows.length > 0) {
                const busyTimes = conflicts.rows
                    .filter(row => !row.isFree)
                    .map(row => `${row.startTime}-${row.endTime}`)
                    .join(', ');
                
                if (busyTimes) {
                    await interaction.reply({
                        content: `You can't be free during this time! You have busy events scheduled`,
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