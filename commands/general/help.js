require('dotenv').config()
const AWS = require('aws-sdk'), permVerifier = require(`../../QOL/permissionsChecker.js`), assert = require('assert'), CE = require(`../../QOL/commonErrors.js`);
const { PermissionsBitField } = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
    name: 'help',
    description: "Returns a message with links to the help channels",
    requiredPerms: [],
    async execute(message, args){
        //Perms checker
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        //Make help message
        let helpMessage = "Hi, I'm " + process.env.BOT_NAME + "!\n";
        helpMessage += "The bot's prefix is `" + process.env.PFIX + "`\n";
        helpMessage += "The bot's wiki: <https://github.com/Jeffzycode/DiplomacyBot/wiki>\n";
        helpMessage += "A list of the bot's commands: <https://github.com/Jeffzycode/DiplomacyBot/wiki/Commands>\n";
        helpMessage += "In case you are interested in self-hosting: <https://github.com/Jeffzycode/DiplomacyBot/wiki/Self-Hosting>\n";
        helpMessage += "Brief instructions on how to set up the bot in your server: <https://github.com/Jeffzycode/DiplomacyBot/wiki/Setting-Up>\n";
        helpMessage += "\n\nAn invite to the bot's help discord: https://discord.gg/qVbsm9Xy7r";
        
        await message.channel.send(helpMessage);
    }
}