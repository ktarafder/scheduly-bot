import { 
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays a drop-down menu of commands with explanations'),
        
    async execute(interaction) {
        // 1) Create the select menu with command choices
        const menu = new StringSelectMenuBuilder()
            .setCustomId('help-menu')
            .setPlaceholder('Select a command to see details!')
            .addOptions([
                {
                    label: 'add',
                    description: 'Add a schedule',
                    value: 'add'
                },
                {
                    label: 'im-free',
                    description: 'Check bot latency',
                    value: 'im-free'
                },
                {
                    label: 'view',
                    description: 'View your schedule',
                    value: 'view'
                },
                {
                    label: 'compare',
                    description: 'Compare schedules',
                    value: 'compare'
                },
                {
                    label: 'rec',
                    description: 'Get recommendations from AI on what to do',
                    value: 'rec'
                },
            ]);

        // 2) Create an ActionRow containing the select menu
        const row = new ActionRowBuilder()
            .addComponents(menu);

        // 3) Send an initial reply with the select menu
        await interaction.reply({
            content: 'Pick a command from the menu below to learn more!',
            components: [row],
            ephemeral: true, // Only the user invoking the command sees this
        });

        // 4) Create a collector to handle the user’s select menu choice
        const filter = (i) =>
            i.customId === 'help-menu' && i.user.id === interaction.user.id;

        // Collect interactions for 60 seconds (60000 ms)
        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            componentType: ComponentType.StringSelect,
            time: 60000,
        });

        collector.on('collect', async (i) => {
            // Identify which menu option was selected
            const selectedValue = i.values[0];
            let details = '';

            switch (selectedValue) {
                case 'add':
                    details = `
**Command:** \`/add\`
**Description:** Add your schedule.
For example, \`/add\` followed by day of the week, the time (ex. 8:25pm-9:30pm), and then the course.
                    `;
                    break;
                case 'im-free':
                    details = `
**Command:** \`/im-free\`
**Description:** Add you free times.
For example, \`/im-free\` followed by the day of the week and the time (ex. 8:25pm-9:30pm).
                    `;
                    break;
                case 'view':
                    details = `
**Command:** \`/view\`
**Description:** View your schedule.
For example, \`/view\` followed by @username.
                    `;
                    break;
                case 'compare':
                    details = `
**Command:** \`/compare\`
**Description:** Compare schedules.
For example, \`/compare\` followed by @username.
                    `;
                    break;
                case 'rec':
                    details = `
**Command:** \`/rec\`
**Description:** Get recommendations from AI on what to do.
For example, \`/rec\` followed by @username.
                    `;
                    break;
                default:
                    details = 'Unknown command. Please select again.';
            }

            // Update the interaction with the details (and remove the menu, if you’d like)
            await i.update({
                content: details,
                components: [], // Remove the menu so user doesn’t pick again
                ephemeral: true,
            });
        });

        collector.on('end', async () => {
            // If you want, you can edit the original reply to remove the menu after time expires
            // or do nothing, depending on your preference.
        });
    },
};
