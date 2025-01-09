import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('compare')
        .setDescription('Compare your schedule with multiple users to find mutual free time')
        .addUserOption(option =>
            option.setName('user1')
                .setDescription('First user to compare schedules with')
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('user2')
                .setDescription('Another user to compare schedules with')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user3')
                .setDescription('Another user to compare schedules with')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user4')
                .setDescription('Another user to compare schedules with')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user5')
                .setDescription('Another user to compare schedules with')
                .setRequired(false)
        ),

    async execute(interaction, dbclient) {
        try {
            // Gather all user IDs from the slash command options
            const userIds = [interaction.user.id]; // Include the command user
            
            // Required user
            const user1 = interaction.options.getUser('user1');
            if (user1) userIds.push(user1.id);
            
            // Optional users
            for (let i = 2; i <= 5; i++) {
                const userX = interaction.options.getUser(`user${i}`);
                if (userX) userIds.push(userX.id);
            }

            // Remove duplicates
            const uniqueIds = [...new Set(userIds)];

            if (uniqueIds.length < 2) {
                await interaction.reply({
                    content: "You need at least 2 distinct users to compare schedules!",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Fetch schedules for all users
            const placeholders = uniqueIds.map(() => '?').join(', ');
            const query = `
                SELECT userId, day, start_time, end_time, is_free, course_name
                FROM schedules
                WHERE userId IN (${placeholders})
                AND day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
                ORDER BY 
                    CASE day
                        WHEN 'Monday' THEN 1
                        WHEN 'Tuesday' THEN 2
                        WHEN 'Wednesday' THEN 3
                        WHEN 'Thursday' THEN 4
                        WHEN 'Friday' THEN 5
                    END,
                    start_time
            `;
            const schedules = await dbclient.execute(query, uniqueIds);

            if (!schedules || schedules.rows.length === 0) {
                await interaction.reply({
                    content: "None of those users have set up their schedule yet!",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Organize schedules by day and user
            const freeTimes = {
                Monday: {},
                Tuesday: {},
                Wednesday: {},
                Thursday: {},
                Friday: {}
            };

            // Initialize sub-objects
            Object.keys(freeTimes).forEach(day => {
                uniqueIds.forEach(id => {
                    freeTimes[day][id] = [];
                });
            });

            // Fill data - only include free times
            schedules.rows.forEach(row => {
                if (row.is_free) {
                    freeTimes[row.day][row.userId].push({
                        start: row.start_time,
                        end: row.end_time
                    });
                }
            });

            // Find mutual free times
            const mutualFreeTimes = {};
            Object.keys(freeTimes).forEach(day => {
                const userIdsForDay = Object.keys(freeTimes[day]);
                let dayIntersection = freeTimes[day][userIdsForDay[0]];

                for (let i = 1; i < userIdsForDay.length; i++) {
                    const userId = userIdsForDay[i];
                    const nextUserFreeTimes = freeTimes[day][userId];
                    dayIntersection = findMultipleOverlap(dayIntersection, nextUserFreeTimes);
                    if (dayIntersection.length === 0) break;
                }

                mutualFreeTimes[day] = dayIntersection;
            });

            // Build embed response
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('📊 Schedule Comparison')
                .setDescription(`Comparing schedules among ${uniqueIds.length} users.`)
                .setTimestamp();

            // Add fields for each day
            Object.entries(mutualFreeTimes).forEach(([day, times]) => {
                const value = times.length > 0
                    ? times.map(t => `\`${minutesToTime(t.start)}-${minutesToTime(t.end)}\``).join('\n')
                    : 'No mutual free time';
                
                embed.addFields({ name: day, value, inline: false });
            });

            await interaction.reply({ embeds: [embed] });

        } catch (err) {
            console.error('Error comparing schedules:', err);
            await interaction.reply({
                content: 'Failed to compare schedules.',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};

// Helper Functions
function findMultipleOverlap(user1Times, user2Times) {
    const overlaps = [];
    user1Times.forEach(time1 => {
        user2Times.forEach(time2 => {
            const overlap = findOverlap(time1, time2);
            if (overlap) {
                overlaps.push(overlap);
            }
        });
    });
    return mergeOverlappingTimes(overlaps);
}

function findOverlap(time1, time2) {
    const start1 = time1.start;
    const end1 = time1.end;
    const start2 = time2.start;
    const end2 = time2.end;

    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);

    if (overlapStart < overlapEnd) {
        return {
            start: overlapStart,
            end: overlapEnd
        };
    }
    return null;
}

function minutesToTime(minutes) {
    let hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const period = hour >= 12 ? 'PM' : 'AM';

    if (hour > 12) hour -= 12;
    else if (hour === 0) hour = 12;

    return minute === 0
        ? `${hour}${period}`
        : `${hour}:${minute.toString().padStart(2, '0')}${period}`;
}

function mergeOverlappingTimes(timeRanges) {
    if (!timeRanges.length) return [];

    // Sort by start time
    timeRanges.sort((a, b) => a.start - b.start);

    const merged = [timeRanges[0]];

    for (let i = 1; i < timeRanges.length; i++) {
        const current = timeRanges[i];
        const last = merged[merged.length - 1];

        if (current.start <= last.end) {
            // Overlaps, so merge them
            last.end = Math.max(last.end, current.end);
        } else {
            // Non-overlapping, so add as new range
            merged.push(current);
        }
    }

    return merged;
}
