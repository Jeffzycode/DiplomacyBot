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
    name: 'force-add',
    description: "Forcibly adds a country as a signatory to a diplomacy channel. Syntax: ~force-add @ROLE #CHANNEL. Does nothing if the country was already a part of the channel.",
    requiredPerms: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageRoles],
    async execute(message, args){
        //Check permissions
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
            await message.channel.send("Invalid format. Use " + process.env.PFIX + "force-add @ROLE #CHANNEL");
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
            await message.channel.send("You cannot add a non-country role to a diplo channel.");
            return;
        }
        if(! serverProfile.diploChannels.hasOwnProperty(channelID)) {
            await message.channel.send("This command is designed for force-adding to diplo channels only.");
            return;

        }
        console.log(roleID);
        console.log(channelID);
        
        //First, adjust channel permissions
        
        try {//Try adjusting channel permissions
            const targetChannel = await message.guild.channels.fetch(channelID);//Fetch target channel
            await targetChannel.permissionOverwrites.create(await message.guild.roles.fetch(roleID), {ViewChannel: true});
        } catch (error){
            console.log(error);
            message.channel.send("Failed to update channel permissions, contact a developer.");
            return;
        }

        //Then, add the role as a member of the diplo channel under the diploChannels table
        try {
            let curCountryRoles = (await docClient.get({TableName: 'diploChannels', Key: {id: channelID}}).promise()).Item.members;
            curCountryRoles[roleID] = true;//Insert
            await updateDB.updateTable('diploChannels', channelID, 'members', curCountryRoles);//Push updates to database
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        //Finally, add the diplo channel to the role under the countryRoles table
        try {
            let curChannels = (await docClient.get({TableName: 'countryRoles', Key: {id: roleID}}).promise()).Item.diploChannels;
            curChannels[channelID] = true;//Insert
            await updateDB.updateTable('countryRoles', roleID, 'diploChannels', curChannels);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        message.channel.send("Added role to diplo channel.");
    }
}