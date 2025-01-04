import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('view')
        .setDescription('View a user\'s schedule')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to view schedule for (optional)')),

    async execute(interaction, dbclient) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        try {
            const results = await dbclient.execute(
                `SELECT day, startTime, endTime, isFree, courseName FROM schedule
                 WHERE userId = ? AND day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
                 ORDER BY 
                 CASE day
                    WHEN 'Monday' THEN 1
                    WHEN 'Tuesday' THEN 2
                    WHEN 'Wednesday' THEN 3
                    WHEN 'Thursday' THEN 4
                    WHEN 'Friday' THEN 5
                 END`,
                [targetUser.id]
            );

            if (!results || results.rows.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setAuthor({ 
                        name: `${targetUser.username}'s Schedule`, 
                        iconURL: targetUser.avatarURL() 
                    })
                    .setDescription('❌ No schedule found for this user.')
                    .setFooter({ text: 'Use /add or /im-free to set your availability' });

                await interaction.reply({ embeds: [emptyEmbed] });
                return;
            }

            // Group times by day and type
            const scheduleByDay = {
                'Monday': { busy: [], free: [] },
                'Tuesday': { busy: [], free: [] },
                'Wednesday': { busy: [], free: [] },
                'Thursday': { busy: [], free: [] },
                'Friday': { busy: [], free: [] }
            };

            results.rows.forEach(row => {
                if (row.isFree) {
                    scheduleByDay[row.day].free.push(`${row.startTime}-${row.endTime}`);
                } else {
                    scheduleByDay[row.day].busy.push({
                        time: `${row.startTime}-${row.endTime}`,
                        course: row.courseName
                    });
                }
            });

            // Create schedule fields with emojis
            const dayEmojis = {
                'Monday': '🌅',    // Sunrise for start of week
                'Tuesday': '📚',   // Books for study/work
                'Wednesday': '📅', // Calendar for mid-week
                'Thursday': '📋',  // Clipboard for planning
                'Friday': '🌟'     // Star for end of week
            };

            const scheduleFields = Object.entries(scheduleByDay).map(([day, times]) => {
                const busyTimes = times.busy.length > 0 
                    ? `❌ Busy:\n${times.busy.map(t => {
                        const timeSlot = `\`${t.time}\``;
                        return t.course ? `${timeSlot} - 📚 ${t.course}` : timeSlot;
                      }).join('\n')}`
                    : '';
                const freeTimes = times.free.length > 0
                    ? `✅ Free:\n${times.free.map(t => `\`${t}\``).join('\n')}`
                    : '';
                
                let value = 'No schedule set';
                if (busyTimes || freeTimes) {
                    value = [busyTimes, freeTimes].filter(Boolean).join('\n\n');
                }

                return {
                    name: `${dayEmojis[day]} ${day}`,
                    value: value,
                    inline: false
                };
            });

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setAuthor({ 
                    name: `${targetUser.username}'s Weekly Schedule`, 
                    iconURL: targetUser.avatarURL() 
                })
                .setDescription('Here\'s their weekday availability:')
                .addFields(scheduleFields)
                .setTimestamp()
                .setFooter({ 
                    text: '❌ = Busy | ✅ = Free to hang out!',
                    iconURL: interaction.client.user.avatarURL()
                });

            await interaction.reply({ embeds: [embed] });

        } catch (err) {
            console.error('Error retrieving schedule:', err);
            await interaction.reply({ 
                content: 'Failed to retrieve schedule.', 
                ephemeral: true 
            });
        }
    },
};
  