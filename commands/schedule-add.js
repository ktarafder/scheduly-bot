export default {
    name: 'schedule add',
    description: 'Add a day/time range to user schedule',
    async execute(message, args, dbclient) {
      // Example usage: "!schedule-add Monday 8AM-10AM"
      console.log('args:', args);
      if (args.length < 4) {
        message.channel.send('Usage: !schedule add <day> <startTime-endTime>');
        return;
      }
  
      const day = args[2];
      const timeRange = args[3];
      const [startTime, endTime] = timeRange.split('-');
      
      if (!startTime || !endTime) {
        message.channel.send('Invalid time range. Example: 8AM-10AM');
        return;
      }
  
      try {
        await dbclient.execute(
          `INSERT INTO schedule (userId, day, startTime, endTime) VALUES (?, ?, ?, ?)`,
          [message.author.id, day, startTime, endTime]
        );
        message.channel.send(`Schedule saved for ${day}, ${startTime}-${endTime}`);
      } catch (err) {
        console.error('Error inserting schedule:', err);
        message.channel.send('Failed to save schedule.');
      }
    },
  };
  