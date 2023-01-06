require('dotenv').config()
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`), assert = require('assert'), CE = require(`../../QOL/commonErrors.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);
const { PermissionsBitField } = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
    name: 'force-remove',
    description: "Forcibly removes a country from being a participant of a diplomacy channel. Syntax: ~force-remove @ROLE #CHANNEL. Does nothing if the role was never a part of the diplo channel to begin with.",
    requiredPerms: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageRoles],
    async execute(message, args){
        //Permission checker
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let roleID, channelID, serverProfile;
        try {//Input Validator
            assert(args.length === 2);
            //Validate that the first argument is a role
            assert(args[0].length > 4);
            roleID = args[0].substring(3, args[0].length-1);
            assert((await message.guild.roles.fetch(roleID)) !== null);
            assert(args[1].length > 3);
            channelID = args[1].substring(2, args[1].length-1);
            assert((await message.guild.channels.fetch(channelID)) !== null);
        } catch (error){
            await message.channel.send("Invalid format. Use " + process.env.PFIX + "force-remove @ROLE #CHANNEL");
            return;
        }
        //Fetch
        try {
            serverProfile = (await docClient.get({TableName: 'servers', Key: {id: message.guildId}}).promise()).Item;
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
        }
        //Other validators
        if(! serverProfile.countryRoles.hasOwnProperty(roleID)){
            await message.channel.send("This command is designed to remove a country role's permissions.");
            return;
        }
        if(! serverProfile.diploChannels.hasOwnProperty(channelID)){
            await message.channel.send("This command is designed to remove a country role's access to a diplo channel");
            return;
        }
        //First, adjust channel permissions
        try {//Try adjusting channel permissions
            const targetChannel = await message.guild.channels.fetch(channelID);//Fetch target channel
            await targetChannel.permissionOverwrites.delete(await message.guild.roles.fetch(roleID));
        } catch (error){
            console.log(error);
            await message.channel.send("Failed to update channel permissions, contact a developer.");
            return;
        }
        //Then remove the role from being a member of the diplo channel in the diploChannels DB
        try {
            let curCountryRoles = (await docClient.get({TableName: 'diploChannels', Key: {id: channelID}}).promise()).Item.members;
            delete curCountryRoles[roleID];//Delete characteristic
            await updateDB.updateTable('diploChannels', channelID, 'members', curCountryRoles);//Push updates to database
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        //Finally, remove the diplo channel to the role under the countryRoles table
        try {
            let curChannels = (await docClient.get({TableName: 'countryRoles', Key: {id: roleID}}).promise()).Item.diploChannels;
            delete curChannels[channelID];//Delete characteristic
            await updateDB.updateTable('countryRoles', roleID, 'diploChannels', curChannels);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        await message.channel.send("Removed role from diplo channel.");
        
    }
}