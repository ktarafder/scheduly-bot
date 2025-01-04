export default {
    name: 'schedule view',
    description: 'View a user\'s schedule',
    async execute(message, dbclient) {
      let userId = message.author.id;
      if (message.mentions.users.size > 0) {
        userId = message.mentions.users.first().id;
      }
  
      try {
        const results = await dbclient.execute(
          `SELECT day, startTime, endTime FROM schedule
           WHERE userId = ? ORDER BY day`,
          [userId]
        );
  
        if (!results || results.rows.length === 0) {
          message.channel.send('No schedule found.');
          return;
        }
  
        let scheduleText = 'Schedule:\n';
        results.rows.forEach((row) => {
          scheduleText += `• ${row.day}: ${row.startTime}-${row.endTime}\n`;
        });
  
        message.channel.send(scheduleText);
      } catch (err) {
        console.error('Error retrieving schedule:', err);
        message.channel.send('Failed to retrieve schedule.');
      }
    },
  };
  