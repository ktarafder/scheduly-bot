import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('compare')
        .setDescription('Compare your schedule with multiple users to find mutual free time')
        // Add up to 5 optional user parameters
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
        // Gather all user IDs from the slash command options
        const userIds = [];
        
        // Required user
        const user1 = interaction.options.getUser('user1');
        if (user1) userIds.push(user1.id);
        
        // Optional users
        for (let i = 2; i <= 5; i++) {
            const userX = interaction.options.getUser(`user${i}`);
            if (userX) {
                // You could skip adding the user if it's the same as user1 or yourself, etc.
                // For now, let's just push them if they exist
                userIds.push(userX.id);
            }
        }

        // Remove duplicates if needed
        const uniqueIds = [...new Set(userIds)];

        // (Optional) Check if user is trying to compare themselves multiple times
        // or if there’s only one user in the entire list, etc.

        if (uniqueIds.length < 2) {
            await interaction.reply({
                content: "You need at least 2 distinct users to compare schedules!",
            });
            return;
        }

        try {
            // 1. Fetch schedules for *all* userIds in one query
            //    We'll only look at Monday-Friday for example
            const placeholders = uniqueIds.map(() => '?').join(', ');
            const query = `
                SELECT userId, day, startTime, endTime, isFree
                FROM schedule
                WHERE userId IN (${placeholders})
                AND day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
                ORDER BY 
                    CASE day
                        WHEN 'Monday' THEN 1
                        WHEN 'Tuesday' THEN 2
                        WHEN 'Wednesday' THEN 3
                        WHEN 'Thursday' THEN 4
                        WHEN 'Friday' THEN 5
                    END
            `;
            const schedules = await dbclient.execute(query, uniqueIds);

            if (!schedules || schedules.rows.length === 0) {
                await interaction.reply({
                    content: "None of those users have set up their schedule yet!",
                    ephemeral: true
                });
                return;
            }

            // 2. Organize schedules in a structure like:
            //    freeTimes[day][userId] = [{start, end}, {start, end}, ...]
            const freeTimes = {
                Monday:   {},
                Tuesday:  {},
                Wednesday:{},
                Thursday: {},
                Friday:   {}
            };

            // Initialize sub-objects
            Object.keys(freeTimes).forEach(day => {
                uniqueIds.forEach(id => {
                    freeTimes[day][id] = [];
                });
            });

            // Fill data
            schedules.rows.forEach(row => {
                if (row.isFree) {
                    freeTimes[row.day][row.userId].push({
                        start: row.startTime,
                        end: row.endTime
                    });
                }
            });

            // 3. For each day, find the intersection of all free times across *all* users
            //    We'll create an array of mutual free times for that day
            const mutualFreeTimes = {};
            Object.keys(freeTimes).forEach(day => {
                // Start by combining the free times for the *first* user,
                // then iteratively intersect with the next user, next user, etc.
                const userIdsForDay = Object.keys(freeTimes[day]);

                // We'll merge free times for user1, then intersect with user2, etc.
                let dayIntersection = freeTimes[day][userIdsForDay[0]];

                // Intersect dayIntersection with each subsequent user
                for (let i = 1; i < userIdsForDay.length; i++) {
                    const userId = userIdsForDay[i];
                    const nextUserFreeTimes = freeTimes[day][userId];
                    // Intersect dayIntersection with nextUserFreeTimes
                    dayIntersection = findMultipleOverlap(dayIntersection, nextUserFreeTimes);
                    // If at any point dayIntersection becomes empty, we can break early
                    if (dayIntersection.length === 0) break;
                }

                mutualFreeTimes[day] = dayIntersection;
            });

            // 4. Build an embed to display results
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('📊 Schedule Comparison')
                .setDescription(`Comparing schedules among ${uniqueIds.length} users.`)
                .setTimestamp();

            // Add fields for each day
            Object.entries(mutualFreeTimes).forEach(([day, times]) => {
                const value = times.length > 0
                    ? times.map(t => `\`${t.start}-${t.end}\``).join('\n')
                    : 'No mutual free time';
                
                embed.addFields({ name: day, value, inline: false });
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


// ===============================
// Helper Functions
// ===============================

// 1. Intersect the free times of two users
//    We'll reuse your "findOverlap" logic but adapt it for multiple ranges
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
    // Merge or reduce overlaps if needed.
    // For simplicity, we leave them as an array of possibly overlapping intervals.
    return mergeOverlappingTimes(overlaps);
}

// 2. The same "findOverlap" you had before, updated for optional minutes
function findOverlap(time1, time2) {
    function convertToMinutes(timeStr) {
        // Supports single/double digit hours, optional minutes, AM/PM
        const match = timeStr.match(/(\d{1,2})(?::(\d{1,2}))?([AP]M)/i);
        if (!match) return null;

        let hour = parseInt(match[1]);
        let minute = match[2] ? parseInt(match[2]) : 0;
        const period = match[3].toUpperCase();

        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;

        return hour * 60 + minute;
    }

    const start1 = convertToMinutes(time1.start);
    const end1 = convertToMinutes(time1.end);
    const start2 = convertToMinutes(time2.start);
    const end2 = convertToMinutes(time2.end);

    if (start1 === null || end1 === null || start2 === null || end2 === null) {
        return null;
    }

    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);

    if (overlapStart < overlapEnd) {
        return {
            start: minutesToTime(overlapStart),
            end: minutesToTime(overlapEnd),
        };
    }
    return null;
}

// 3. Convert minutes back to something like "3PM" or "3:20PM"
function minutesToTime(totalMinutes) {
    let hour = Math.floor(totalMinutes / 60);
    let minute = totalMinutes % 60;
    const period = hour >= 12 ? 'PM' : 'AM';

    if (hour > 12) hour -= 12;
    else if (hour === 0) hour = 12;

    const minuteStr = minute < 10 ? `0${minute}` : `${minute}`;
    return minute === 0
        ? `${hour}${period}`
        : `${hour}:${minuteStr}${period}`;
}

// 4. Optionally merge or reduce overlapping intervals from the results
//    This step ensures if you have multiple small overlaps that also overlap each other,
//    they become one bigger range. You can skip this if you don’t mind multiple sub-overlaps.
function mergeOverlappingTimes(timeRanges) {
    if (!timeRanges.length) return [];

    // Convert each range to numeric for easier sorting
    const numericRanges = timeRanges.map(range => {
        return {
            start: convertToMins(range.start),
            end: convertToMins(range.end)
        };
    });

    // Sort by start time
    numericRanges.sort((a, b) => a.start - b.start);

    const merged = [ numericRanges[0] ];

    for (let i = 1; i < numericRanges.length; i++) {
        const current = numericRanges[i];
        const last = merged[merged.length - 1];

        if (current.start <= last.end) {
            // Overlaps, so merge them by extending the end if needed
            last.end = Math.max(last.end, current.end);
        } else {
            // Non-overlapping, so just push
            merged.push(current);
        }
    }

    // Convert back to your "start/end" string format
    return merged.map(range => {
        return {
            start: minutesToTime(range.start),
            end: minutesToTime(range.end),
        };
    });
}

function convertToMins(timeStr) {
    // We'll reuse the same approach from findOverlap
    const match = timeStr.match(/(\d{1,2})(?::(\d{1,2}))?([AP]M)/i);
    if (!match) return 0;

    let hour = parseInt(match[1]);
    let minute = match[2] ? parseInt(match[2]) : 0;
    const period = match[3].toUpperCase();

    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    return hour * 60 + minute;
}
