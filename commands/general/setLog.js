require('dotenv').config()
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`), assert = require('assert'), permVerifier = require(`../../QOL/permissionsChecker.js`);
const {PermissionsBitField} = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
    name: 'set-log',
    description: "Changing the log channel",
    requiredPerms: [PermissionsBitField.Flags.Administrator],
    async execute(message, args){
        //Check permissions
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        try {//Format validator
            assert.equal(args.length, 1);//One parameter only
            assert(args[0].length > 3);
            assert((await message.guild.channels.fetch(args[0].substring(2, args[0].length-1))) !== null);//Channel exists
            assert((await message.guild.channels.fetch(args[0].substring(2, args[0].length-1))).type === 0);//Must be a text channel
        } catch (error) {
            message.channel.send("Invalid format. Use ~set-log #CHANNELNAME");
            return;
        }
        let newLogChannel = args[0].substring(2, args[0].length-1);
        try {//Try to push changes to database
            let guildChannel = message.channel;
            await updateDB.updateTable('servers', guildChannel.guildId, 'logChannel', newLogChannel);
            console.log("Successfully changed log channel of server " + guildChannel.guild.name);
            message.guild.channels.fetch(newLogChannel).then(channel => channel.send("Verify that this is the correct log channel."));
        } catch (error) {
            console.log("Error when changing the log channel, " + error);
            return;
        }
          
    }
}