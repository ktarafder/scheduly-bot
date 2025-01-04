import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot\'s latency'),

    async execute(interaction) {
        // Initial response time
        const sent = await interaction.reply({ 
            content: 'Pinging...', 
            fetchReply: true 
        });

        // Calculate round-trip latency
        const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
        
        // Create embed
        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setAuthor({ 
                name: interaction.client.user.username, 
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .addFields(
                { 
                    name: '🏓 Pong!', 
                    value: `Roundtrip latency: \`${roundtripLatency}ms\`\nWebSocket latency: \`${interaction.client.ws.ping}ms\``
                }
            )
            .setTimestamp();

        // Edit the initial response with the embed
        await interaction.editReply({ content: null, embeds: [embed] });
    },
};
