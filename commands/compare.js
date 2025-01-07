import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('compare')
        .setDescription('Compare your schedule with another user to find mutual free time')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to compare schedules with')
                .setRequired(true)),

    async execute(interaction, dbclient) {
        const targetUser = interaction.options.getUser('user');
        
        if (targetUser.id === interaction.user.id) {
            await interaction.reply({
                content: "You can't compare schedules with yourself!",
                ephemeral: true
            });
            return;
        }

        try {
            // Get both users' schedules
            const schedules = await dbclient.execute(
                `SELECT userId, day, startTime, endTime, isFree
                 FROM schedule
                 WHERE userId IN (?, ?)
                 AND day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
                 ORDER BY 
                    CASE day
                        WHEN 'Monday' THEN 1
                        WHEN 'Tuesday' THEN 2
                        WHEN 'Wednesday' THEN 3
                        WHEN 'Thursday' THEN 4
                        WHEN 'Friday' THEN 5
                    END`,
                [interaction.user.id, targetUser.id]
            );

            if (!schedules || schedules.rows.length === 0) {
                await interaction.reply({
                    content: "One or both users don't have any schedule set up yet!",
                    ephemeral: true
                });
                return;
            }

            // Organize schedules by day and user
            const freeTimes = {
                'Monday': { user1: [], user2: [] },
                'Tuesday': { user1: [], user2: [] },
                'Wednesday': { user1: [], user2: [] },
                'Thursday': { user1: [], user2: [] },
                'Friday': { user1: [], user2: [] }
            };

            schedules.rows.forEach(row => {
                if (row.isFree) {
                    const userKey = row.userId === interaction.user.id ? 'user1' : 'user2';
                    freeTimes[row.day][userKey].push({
                        start: row.startTime,
                        end: row.endTime
                    });
                }
            });

            // Find overlapping free times
            const mutualFreeTimes = {};
            Object.keys(freeTimes).forEach(day => {
                mutualFreeTimes[day] = [];
                freeTimes[day].user1.forEach(time1 => {
                    freeTimes[day].user2.forEach(time2 => {
                        const overlap = findOverlap(time1, time2);
                        if (overlap) {
                            mutualFreeTimes[day].push(overlap);
                        }
                    });
                });
            });

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('📊 Schedule Comparison')
                .setDescription(`Comparing schedules between ${interaction.user} and ${targetUser}`)
                .setTimestamp();

            // Add fields for each day
            Object.entries(mutualFreeTimes).forEach(([day, times]) => {
                const value = times.length > 0
                    ? times.map(t => `\`${t.start}-${t.end}\``).join('\n')
                    : 'No mutual free time';
                
                embed.addFields({
                    name: `${day}`,
                    value: value,
                    inline: false
                });
            });

            await interaction.reply({ embeds: [embed] });

        } catch (err) {
            console.error('Error comparing schedules:', err);
            await interaction.reply({
                content: 'Failed to compare schedules.',
                ephemeral: true
            });
        }
    },
};

// Helper function to find overlapping time slots
function findOverlap(time1, time2) {
    function convertToMinutes(timeStr) {
        const [hours, period] = timeStr.match(/(\d+)([AP]M)/).slice(1);
        let hour = parseInt(hours);
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        return hour * 60;
    }

    const start1 = convertToMinutes(time1.start);
    const end1 = convertToMinutes(time1.end);
    const start2 = convertToMinutes(time2.start);
    const end2 = convertToMinutes(time2.end);

    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);

    if (overlapStart < overlapEnd) {
        function minutesToTime(minutes) {
            let hour = Math.floor(minutes / 60);
            const period = hour >= 12 ? 'PM' : 'AM';
            if (hour > 12) hour -= 12;
            if (hour === 0) hour = 12;
            return `${hour}${period}`;
        }

        return {
            start: minutesToTime(overlapStart),
            end: minutesToTime(overlapEnd)
        };
    }

    return null;
}