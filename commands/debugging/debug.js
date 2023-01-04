require('dotenv').config()
const AWS = require('aws-sdk'), permVerifier = require(`../../QOL/permissionsChecker.js`);
const { PermissionsBitField } = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
    name: 'debug',
    description: "Misc command for testing stuff",
    requiredPerms: [PermissionsBitField.Flags.BanMembers],
    async execute(message, args){
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, true, message))) return;
        await message.channel.send("Ehehehe, you can kick people.");
    }
}