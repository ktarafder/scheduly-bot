import { SlashCommandBuilder } from 'discord.js';
import OpenAI from "openai";

export default {
    data: new SlashCommandBuilder()
        .setName('rec')
        .setDescription('Ask me anything!')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('What would you like to ask?')
                .setRequired(true)),
        
    async execute(interaction) {
        await interaction.deferReply();
        const openai = new OpenAI({
            apiKey: process.env.GALADRIEL_KEY,
            baseURL: "https://api.galadriel.com/v1"
        });

        const userMessage = interaction.options.getString('message');
        
        try {
            const completion = await openai.chat.completions.create({
                model: "llama3.1:405b",
                messages: [
                    { role: "system", content: process.env.SECRET_SYS_PROMPT },
                    { role: "user", content: userMessage },
                ],
            });

            console.log(completion.choices[0].message.content);
            
            await interaction.editReply(completion.choices[0].message.content);
        } catch (error) {
            console.error('Error:', error);
            await interaction.reply({ 
                content: 'Sorry, I encountered an error processing your request.',
                ephemeral: true 
            });
        }
    }
}