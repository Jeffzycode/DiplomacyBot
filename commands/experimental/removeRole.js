require('dotenv').config()
const AWS = require('aws-sdk');
const { MessageFlags } = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
    name: 'remove-role',
    description: "Removes roles, for use when debugging permissions",
    async execute(message, args){
        let fetchedRole = await message.guild.roles.fetch(args[0].substring(3, args[0].length-1));
        await (await message.guild.members.fetch(message.author.id)).roles.remove(fetchedRole);
    }
}