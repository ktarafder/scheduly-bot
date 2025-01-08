import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas } from 'canvas';

export default {
  data: new SlashCommandBuilder()
    .setName('view')
    .setDescription('View a user\'s schedule (fancy blocks)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to view schedule for (optional)')
    ),

  async execute(interaction, dbclient) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    try {
      const results = await dbclient.execute(
        `SELECT day, startTime, endTime, isFree, courseName
         FROM schedule
         WHERE userId = ?
           AND day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
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
          content: `❌ No schedule found for **${targetUser.username}**.\nUse /add or /im-free to set availability!`,
          ephemeral: true
        });
        return;
      }

      // Organize the schedule by day
      const scheduleByDay = {
        Monday:   [],
        Tuesday:  [],
        Wednesday:[],
        Thursday: [],
        Friday:   []
      };

      results.rows.forEach(row => {
        scheduleByDay[row.day].push({
          startTime: row.startTime,
          endTime: row.endTime,
          isFree: row.isFree,
          courseName: row.courseName
        });
      });

      // Generate the fancy schedule image
      const imageBuffer = createFancyScheduleGraphic(targetUser.displayName, scheduleByDay);

      // Send as an attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'schedule.png' });
      await interaction.reply({ files: [attachment] });

    } catch (err) {
      console.error('Error retrieving schedule:', err);
      await interaction.reply({
        content: 'Failed to retrieve schedule.',
        ephemeral: true
      });
    }
  }
};

// ==========================================
// Node-canvas Rendering Logic
// ==========================================
function createFancyScheduleGraphic(username, scheduleByDay) {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const START_HOUR = 8;
    const END_HOUR = 17;
  
    // Layout Constants
    const topMargin = 60;
    const leftMargin = 50;
    const hourHeight = 60;
    const dayWidth = 130;
    const titleHeight = 40;
    const canvasWidth = leftMargin + dayWidth * DAYS.length + 50;
    const canvasHeight = topMargin + titleHeight + hourHeight * (END_HOUR - START_HOUR) + 30;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
  
    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`${username}'s Weekly Schedule`, 20, 30);
  
    // Day Headers
    ctx.font = 'bold 14px sans-serif';
    DAYS.forEach((day, i) => {
      const x = leftMargin + i * dayWidth + 10;
      const y = topMargin;
      ctx.fillStyle = '#333';
      ctx.fillText(day, x, y - 10);
    });
  
    // Time Labels
    ctx.font = '12px sans-serif';
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      const label = formatHourLabel(h);
      const y = topMargin + titleHeight + (h - START_HOUR) * hourHeight;
      ctx.fillStyle = '#666';
      ctx.fillText(label, 10, y);
    }
  
    // Grid lines
    drawGrid(ctx, DAYS, START_HOUR, END_HOUR, dayWidth, hourHeight, leftMargin, topMargin, titleHeight, canvasWidth);
  
    // We'll track drawn events per day so we can check collisions.
    // dayPositions[day] = array of { x, y, w, h } for each event drawn
    const dayPositions = {};
    DAYS.forEach(day => dayPositions[day] = []);
  
    // Draw each day's events
    DAYS.forEach((day, dayIndex) => {
      const events = scheduleByDay[day] || [];
      
      events.forEach(evt => {
        let startPos = timeToY(evt.startTime, START_HOUR, hourHeight, topMargin, titleHeight);
        const endPos = timeToY(evt.endTime, START_HOUR, hourHeight, topMargin, titleHeight);
  
        // Height of the event
        let h = endPos - startPos - 4;
        // If h is super small, enforce a minimum so color is visible
        if (h < 30) {
          h = 30; 
        }
  
        // X & W for the event
        let x = leftMargin + dayIndex * dayWidth + 2;
        let w = dayWidth - 4;
  
        // Check collision with previously drawn events in this day
        let adjustedStartPos = startPos;
        let keepChecking = true;

        while (keepChecking) {
            const collisions = dayPositions[day].filter(pos => {
            const posBottom = pos.y + pos.h;
            const thisBottom = adjustedStartPos + h;
            return !(posBottom < adjustedStartPos || pos.y > thisBottom);
            });

            if (collisions.length > 0) {
            // If there's a collision, move down below the last colliding event
            const lastCollision = collisions.reduce((latest, pos) => {
                return (pos.y + pos.h > latest.y + latest.h) ? pos : latest;
            });
            adjustedStartPos = lastCollision.y + lastCollision.h + 2;
            } else {
            keepChecking = false;
            }
        }

        // Use the adjusted position
        startPos = adjustedStartPos;
        // Choose fill color and label
        let fillColor;
        let labelText;
        if (evt.isFree) {
          fillColor = '#CCFFCC';  // green for free
          labelText = 'Available';
        } else {
          labelText = evt.courseName ? evt.courseName : 'Busy';
          fillColor = evt.courseName ? '#DABAFD' : '#FFD7D7';  
        }
  
        // Draw the block
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, startPos + 2, w, h);
  
        // Label text
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(labelText, x + 6, startPos + 16);
  
        // Time range text
        ctx.font = '10px sans-serif';
        const rangeText = `${evt.startTime}–${evt.endTime}`;
        ctx.fillText(rangeText, x + 6, startPos + 28);
  
        // (NEW) Remember this position to detect collisions with subsequent events
        dayPositions[day].push({ x, y: startPos, w, h });
      });
    });
  
    return canvas.toBuffer('image/png');
  }
  
  // The rest is the same as before: drawGrid, timeToY, convertToMinutes, formatHourLabel, etc.
  function drawGrid(ctx, DAYS, startHour, endHour, dayWidth, hourHeight, leftMargin, topMargin, titleHeight, canvasWidth) {
    ctx.strokeStyle = '#DDD';
    ctx.lineWidth = 1;
  
    // Horizontal lines
    for (let h = startHour; h <= endHour; h++) {
      const y = topMargin + titleHeight + (h - startHour) * hourHeight;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(canvasWidth - 30, y);
      ctx.stroke();
    }
  
    // Vertical lines
    for (let i = 0; i <= DAYS.length; i++) {
      const x = leftMargin + i * dayWidth;
      ctx.beginPath();
      ctx.moveTo(x, topMargin);
      ctx.lineTo(x, topMargin + titleHeight + (endHour - startHour) * hourHeight);
      ctx.stroke();
    }
  }
  
  function timeToY(timeStr, startHour, hourHeight, topMargin, titleHeight) {
    const mins = convertToMinutes(timeStr);
    const startMins = startHour * 60; 
    const offsetMins = mins - startMins;
    return topMargin + titleHeight + (offsetMins / 60) * hourHeight;
  }
  
  function convertToMinutes(timeStr) {
    const match = timeStr.match(/(\d{1,2})(?::(\d{1,2}))?(AM|PM)/i);
    if (!match) return 0;
  
    let hour = parseInt(match[1]);
    let minute = match[2] ? parseInt(match[2]) : 0;
    const period = match[3].toUpperCase();
  
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
  
    return hour * 60 + minute;
  }
  
  function formatHourLabel(hour24) {
    const period = hour24 >= 12 ? 'PM' : 'AM';
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    return `${hour12}${period}`;
  }
  