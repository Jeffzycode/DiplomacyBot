require('dotenv').config()
const AWS = require('aws-sdk'), assert = require('assert'), updateDB = require(`../../QOL/updateDB.js`), CE = require(`../../QOL/commonErrors.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);
const { PermissionsBitField } = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

async function deleteChannelRecords(channelID){
    let channelProfile, serverProfile;
    try {
        channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: channelID}}).promise();
    } catch (error) {
        await CE.databaseFetchError(error);
    }
    //Step 1. Delete records from server profile
    try {
        serverProfile = await docClient.get({TableName: 'servers', Key: {id: channelProfile.Item.server}}).promise();
    } catch (error) {
        await CE.databaseFetchError(error);
    }
    delete serverProfile.Item.diploChannels[channelID];
    try {
        await updateDB.updateTable('servers', serverProfile.Item.id, 'diploChannels', serverProfile.Item.diploChannels);
    } catch (error) {
        await CE.databasePushError(error);
    }
    //Step 2. Delete records from country profiles
    for(channelMember in channelProfile.Item.members) {
        let curCountryProfile;
        try {//Fetch
            curCountryProfile = await docClient.get({TableName: 'countryRoles', Key: {id: channelMember}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error);
        }
        delete curCountryProfile.Item.diploChannels[channelID];
        try {
            await updateDB.updateTable('countryRoles', curCountryProfile.Item.id, 'diploChannels', curCountryProfile.Item.diploChannels);
        } catch (error) {
            await CE.databasePushError(error);
        }
    }
    //Step 3. Delete records from diploChannels db
    try {
        await docClient.delete({TableName: 'diploChannels', Key: {id: channelID}}).promise();
    } catch (error) {
        await CE.dataDeleteError(error);
    }
    
}

module.exports = {
    name: 'archive-channel',
    description: "Archives a channel by deleting it from the database, and moving it to the archive category if it exists.",
    requiredPerms: [PermissionsBitField.Flags.ManageChannels],
    async execute(message, args){
        //Step 0. Check Perms
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        //Step 1. Validate input (input is indeed a channel)
        let channelID;
        try {
            assert(args.length === 1);
            assert(args[0].length > 3);
            channelID = args[0].substring(2, args[0].length-1);
            assert((await message.guild.channels.fetch(channelID)) !== null);
        } catch (error) {
            await message.channel.send("Invalid command. Use "+ process.env.PFIX + "archive-channel #CHANNEL");
            return;
        }
        //Step 2. Check that the channel is a diplo channel
        let serverProfile;
        try {
            serverProfile = await docClient.get({TableName: 'servers', Key: {id: message.guild.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error);
        }
        if(! serverProfile.Item.diploChannels.hasOwnProperty(channelID)) {
            await message.channel.send("You cannot archive a non-diplo channel.");
            return;
        }
        //Step 3. Delete records of the diplo channel
        await deleteChannelRecords(channelID);
        //Step 4. Adjust channel permissions
        let channelObj = await message.guild.channels.fetch(channelID);
        //Set parent
        if(serverProfile.Item.archiveCategory !== undefined) await channelObj.setParent(serverProfile.Item.archiveCategory);
        else await channelObj.setParent(null);
        //Edit permissions
        await channelObj.edit({
            permissionOverwrites: [
                {
                    id: message.guild.roles.everyone,
                    deny: [PermissionsBitField.Flags.ViewChannel]
                }
            ]
        })
        //Step 5. Confirmation message
        await channelObj.send("This channel has been archived.");
        await message.channel.send("Channel archived successfully.");
    }
}