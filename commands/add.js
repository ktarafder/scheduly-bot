import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add an event or course to your schedule')
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
                .setDescription('Time range (format: 8am-10am, 9:30am-10:30am)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('course')
                .setDescription('Course or event name')
                .setRequired(true)),

    async execute(interaction, dbclient) {
        try {
            const userId = interaction.user.id;
            const day = interaction.options.getString('day');
            const timeRange = interaction.options.getString('timerange');
            const courseName = interaction.options.getString('course');

            // Validate and split timerange
            if (!timeRange || !timeRange.includes('-')) {
                return await interaction.reply({
                    content: 'Please provide a valid time range (e.g., 9am-10am, 9am-10:30am)',
                    ephemeral: true
                });
            }

            const [startTime, endTime] = timeRange.split('-');

            // More flexible time format regex
            const timeFormatRegex = /^(1[0-2]|0?[1-9])(?::([0-5][0-9]))?\s*(am|pm)$/i;
            
            // Clean up time strings (remove spaces, standardize AM/PM)
            const cleanTimeStr = (str) => {
                if (typeof str !== 'string') return '';
                return str.replace(/\s+/g, '').toLowerCase();
            };

            const cleanStartTime = cleanTimeStr(startTime);
            const cleanEndTime = cleanTimeStr(endTime);

            if (!timeFormatRegex.test(cleanStartTime) || !timeFormatRegex.test(cleanEndTime)) {
                return await interaction.reply({
                    content: 'Invalid time format. Please use format like "9am-10am" or "9am-10:30am"',
                    ephemeral: true
                });
            }

            // Convert times to minutes since midnight
            const convertTimeToMinutes = (timeStr) => {
                const match = cleanTimeStr(timeStr).match(timeFormatRegex);
                if (!match) return null;
                
                let hours = parseInt(match[1]);
                const minutes = match[2] ? parseInt(match[2]) : 0;
                const period = match[3].toLowerCase();
                
                if (period === 'pm' && hours !== 12) hours += 12;
                if (period === 'am' && hours === 12) hours = 0;
                
                return hours * 60 + minutes;
            };

            const startMinutes = convertTimeToMinutes(startTime);
            const endMinutes = convertTimeToMinutes(endTime);

            if (startMinutes === null || endMinutes === null) {
                return await interaction.reply({
                    content: 'Failed to parse time format. Please use format like "9am-10am" or "9am-10:30am"',
                    ephemeral: true
                });
            }

            // Validate time range
            if (startMinutes >= endMinutes) {
                return await interaction.reply({
                    content: 'End time must be after start time',
                    ephemeral: true
                });
            }

            // Check for conflicts
            const conflicts = await dbclient.execute(`
                SELECT start_time, end_time, course_name
                FROM schedules
                WHERE userId = ?
                AND day = ?
                AND (
                    (? BETWEEN start_time AND end_time) OR  -- New start time falls within existing event
                    (? BETWEEN start_time AND end_time) OR  -- New end time falls within existing event
                    (? <= start_time AND ? >= end_time)     -- New event completely encompasses existing event
                )
            `, [userId, day, startMinutes, endMinutes, startMinutes, endMinutes]);

            if (conflicts.rows.length > 0) {
                const conflictingEvents = conflicts.rows.map(event => {
                    const startHour = Math.floor(event.start_time / 60);
                    const startMin = event.start_time % 60;
                    const endHour = Math.floor(event.end_time / 60);
                    const endMin = event.end_time % 60;
                    
                    const formatTime = (hour, min) => {
                        const period = hour >= 12 ? 'PM' : 'AM';
                        const hour12 = hour % 12 || 12;
                        return `${hour12}:${min.toString().padStart(2, '0')}${period}`;
                    };

                    const timeStr = `${formatTime(startHour, startMin)}-${formatTime(endHour, endMin)}`;
                    return event.course_name 
                        ? `${timeStr} (${event.course_name})`
                        : timeStr;
                }).join(', ');

                return await interaction.reply({
                    content: `Cannot add this time slot. Conflicts with existing event(s): ${conflictingEvents}`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // First, ensure user exists in users table
            await dbclient.execute(`
                INSERT OR IGNORE INTO users (user_id, name)
                VALUES (?, ?)
            `, [userId, interaction.user.displayName]);

            // Then add the schedule
            await dbclient.execute(`
                INSERT INTO schedules (userId, day, start_time, end_time, is_free, course_name)
                VALUES (?, ?, ?, ?, FALSE, ?)
            `, [userId, day, startMinutes, endMinutes, courseName]);

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
  