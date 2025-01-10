import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('nenu-nini-premisthunnanu')
    .setDescription('Mee prema ni oka fun GIF tho vyaktam cheyyandi!')
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('Yevvarni target cheyyali ani meeru korukuntunnaru?')
        .setRequired(true)
    ),
  
  async execute(interaction) {
    // Options nundi user ni pondandi
    const targetUser = interaction.options.getUser('target');

    // Meeru <@userID> tho varninchavachu mee content lo
    await interaction.reply({
      content: `Oreyyy <@${targetUser.id}>, nenu nini premisthunnanu ra!`, 
      embeds: [
        {
          title: 'Premanu Anubhavinchu! ❤️',
          image: {
            url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExMTl2a3JxYzc4NWliYW52eDNjc3c3bXZ1azB2enNndG1rZWwzc215diZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/hJEIdUzehsFgyDW8wk/giphy.gif',
          },
          color: 0xFF0000
        }
      ]
    });
  },
};