require('dotenv').config();
const assert = require('assert');
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`), CE = require(`../../QOL/commonErrors.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);
const {PermissionsBitField} = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

async function disconnectCountry(treatyID, roleID){
    let countryProfile;
    try {
        countryProfile = await docClient.get({TableName: 'countryRoles', Key: {id: roleID}}).promise();
    } catch (error){
        await CE.databaseFetchError(error);
    }
    if(countryProfile.Item === undefined) return;//Old role which was deleted, or otherwise
    delete countryProfile.Item.treaties[treatyID];//Delete attribute
    try {
        await updateDB.updateTable('countryRoles', roleID, 'treaties', countryProfile.Item.treaties);//Push changes
    } catch (error) {
        await CE.databasePushError(error);
    }
}

module.exports = {    
    name: 'void-treaty',
    description: "Voids the treaty with the provided ID.",
    requiredPerms: [PermissionsBitField.Flags.Administrator],
    async execute(message, args){
        //Perms checker
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        //Step 1. Validate input and provided ID
        if(args.length !== 1){//Must accept one argument
            message.channel.send("Invalid command. Use ~void-treaty <ID>");
            return;
        }
        //Step 2. Fetch Treaty
        let treatyProfile;
        try {//Fetch profile
            treatyProfile = await docClient.get({TableName: 'treaties', Key: {id: args[0]}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
        }
        if(treatyProfile.Item === undefined) {//Invalid ID provided
            message.channel.send("Treaty not found.");
            return;
        }
        //Step 3. Disconnect Treaty from CountryRoles
        //DO NOT assume that country roles is in sync with treaty (designed to keep track of treaties even for deleted roles, protection against griefing in a way)
        for(signatory in treatyProfile.Item.signatories) await disconnectCountry(treatyProfile.Item.id, signatory);
        //Step 4. Disconnect Treaty from server
        let serverProfile;
        try {
            serverProfile = await docClient.get({TableName: 'servers', Key: {id: message.guild.id}}).promise();
        } catch (error){
            await CE.databaseFetchError(error, message.channel);
        }
        delete serverProfile.Item.treaties[treatyProfile.Item.id];//Delete attribute
        try {
            await updateDB.updateTable('servers', message.guild.id, 'treaties', serverProfile.Item.treaties);//Push changes
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        //Step 5. Delete treaty
        try {
            await docClient.delete({TableName: 'treaties', Key: {id: treatyProfile.Item.id}}).promise();
        } catch (error) {
            await CE.dataDeleteError(error, message.channel);
        }
        //Step 6. Send message in treaty output channel
        if(serverProfile.treatyChannel !== "NULL"){
            await (await message.guild.channels.fetch(serverProfile.Item.treatyChannel)).send("Voided **" + treatyProfile.Item.title + "** (ID: " + treatyProfile.Item.id + ")");
        }
        //Step 7. Send confirmation message to user
        message.channel.send("Treaty voided successfully");
    }
}