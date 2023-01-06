require('dotenv').config()
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`), assert = require('assert'), CE = require(`../../QOL/commonErrors.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);
const {PermissionsBitField} = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
    name: 'set-treaty-channel',
    description: "Changing the treaty output channel",
    requiredPerms: [PermissionsBitField.Flags.ManageChannels],
    async execute(message, args){
        //Perms checker
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        try {//Format validator
            assert.equal(args.length, 1);//One parameter only
            assert(args[0].length > 3);
            assert((await message.guild.channels.fetch(args[0].substring(2, args[0].length-1))) !== null);//Channel must exist
            assert((await message.guild.channels.fetch(args[0].substring(2, args[0].length-1))).type === 0);//Must be a text channel
        } catch (error) {
            await message.channel.send("Invalid format. Use " + process.env.PFIX + "set-treaty-channel #CHANNELNAME");
            console.log(error);
            return;
        }
        let newTreatyChannel = args[0].substring(2, args[0].length-1);
        try {//Try to change the treaty output channel
            let guildChannel = message.channel;
            try {
                await updateDB.updateTable('servers', guildChannel.guildId, 'treatyChannel', newTreatyChannel);
            } catch (error) {
                await CE.databasePushError(error, message.channel);
            }
            console.log("Successfully changed treaty channel of server " + guildChannel.guild.name);
            message.guild.channels.fetch(newTreatyChannel).then(channel => channel.send("Verify that this is the correct treaty channel."));
        } catch (error) {
            console.log("Error when changing the treaty channel, " + error);
            return;
        }
          
    }
}