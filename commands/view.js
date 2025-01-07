import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas, registerFont } from 'canvas'; // <-- NEW
// If you want custom fonts, you can register them with registerFont()

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
                await interaction.reply({
                    content: `❌ No schedule found for ${targetUser.username}`,
                    ephemeral: true
                });
                return;
            }

            // 1. Group times by day and type
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

            // 2. Generate a nice calendar graphic
            const imageBuffer = createScheduleGraphic(scheduleByDay, targetUser.displayName);

            // 3. Send the image as an attachment
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'schedule.png' });
            await interaction.reply({ files: [attachment] });

        } catch (err) {
            console.error('Error retrieving schedule:', err);
            await interaction.reply({ 
                content: 'Failed to retrieve schedule.', 
                ephemeral: true 
            });
        }
    },
};


// ============================
// Helper: Create a schedule image
// ============================
function createScheduleGraphic(scheduleByDay, username) {
  // Canvas size - adjust as needed
  const width = 800;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Optional: register a custom font if you want
  // registerFont('path/to/someFont.ttf', { family: 'MyCustomFont' });
  
  // 1. Fill background
  ctx.fillStyle = '#ffffff'; 
  ctx.fillRect(0, 0, width, height);

  // 2. Title
  ctx.fillStyle = '#333';
  ctx.font = '28px sans-serif';
  ctx.fillText(`${username}'s Weekly Schedule`, 20, 40);

  // Days of the week (Mon-Fri)
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
  // We'll draw a simple table:
  // * 5 columns for each weekday
  // * We'll also add a small row at the top for column headers
  const tableX = 20;
  const tableY = 60;
  const tableWidth = width - 40;   // 40 px total horizontal padding
  const tableHeight = height - 100; // 100 px top/bottom for margin, text, etc.

  // Column widths and row heights
  const colWidth = tableWidth / 5; 
  const rowHeight = 70;           // We'll just do 2 or 3 rows for "busy" vs. "free" text

  // 3. Draw column headers (the days)
  days.forEach((day, i) => {
    const xPos = tableX + i * colWidth;
    
    // Day header background
    ctx.fillStyle = '#F0F0F0';
    ctx.fillRect(xPos, tableY, colWidth, 30);

    // Day header text
    ctx.fillStyle = '#000000';
    ctx.font = '18px sans-serif';
    ctx.fillText(day, xPos + 10, tableY + 20);
  });

  // 4. For each day, draw the busy/free times
  days.forEach((day, i) => {
    const xPos = tableX + i * colWidth;
    // We'll have 1 row for "Busy", 1 row for "Free"
    // row1: busy, row2: free
    const busyY = tableY + 40;  // row #1
    const freeY = tableY + 40 + rowHeight; // row #2

    // Busy background
    ctx.fillStyle = '#FFEFEF'; // light red
    ctx.fillRect(xPos, busyY, colWidth, rowHeight - 10);

    // Free background
    ctx.fillStyle = '#E7FFE7'; // light green
    ctx.fillRect(xPos, freeY, colWidth, rowHeight - 10);

    // Busy text
    ctx.fillStyle = '#000';
    ctx.font = '16px sans-serif';

    const busyEntries = scheduleByDay[day].busy.map(item => {
      if (item.course) {
        return `${item.time} (${item.course})`;
      }
      return item.time;
    });
    const busyText = busyEntries.length
      ? `❌ Busy:\n${busyEntries.join('\n')}`
      : 'None';

    wrapText(ctx, busyText, xPos + 8, busyY + 20, colWidth - 16, 18);

    // Free text
    ctx.fillStyle = '#000';
    const freeEntries = scheduleByDay[day].free.map(t => t);
    const freeText = freeEntries.length
      ? `✅ Free:\n${freeEntries.join('\n')}`
      : 'None';

    wrapText(ctx, freeText, xPos + 8, freeY + 20, colWidth - 16, 18);
  });

  return canvas.toBuffer();
}

/**
 * Simple text wrapping helper for node-canvas
 * @param {CanvasRenderingContext2D} ctx - The drawing context
 * @param {string} text - The text to draw
 * @param {number} x - The x coordinate to start drawing
 * @param {number} y - The y coordinate to start drawing
 * @param {number} maxWidth - The maximum width before wrapping
 * @param {number} lineHeight - The height between lines
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = text.split('\n');
  lines.forEach(line => {
    let words = line.split(' ');
    let currentLine = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = currentLine + words[n] + ' ';
      const { width } = ctx.measureText(testLine);
      if (width > maxWidth) {
        ctx.fillText(currentLine, x, y);
        currentLine = words[n] + ' ';
        y += lineHeight;
      } else {
        currentLine = testLine;
      }
    }
    ctx.fillText(currentLine, x, y);
    y += lineHeight;
  });
}
