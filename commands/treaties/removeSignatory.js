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

module.exports = {    
    name: 'remove-signatory',
    description: "Forcibly removes a signatory to the treaty.",
    requiredPerms: [PermissionsBitField.Flags.Administrator],
    async execute(message, args){
        //Check perms
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return false;
        //Step 1. Validate input, must contain one role
        let channelProfile, roleID;
        try {
            assert(args.length === 1);//Contains exactly one argument
            assert(args[0].length > 4);//Length validator
            roleID = args[0].substring(3, args[0].length-1);
            assert((await message.guild.roles.fetch(roleID)) !== null);//Check that the argument is indeed a role
        } catch (error) {
            message.channel.send("Invalid command. Use ~remove-signatory @ROLE");
            return;
        }
        try {//Fetch channel profile
            channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: message.channel.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
            return;
        }
        if(channelProfile.Item === undefined) {//Not a diplo channel
            message.channel.send("You cannot remove a signatory in a non-diplo channel.");
            return;
        }
        if(Object.keys(channelProfile.Item.curTreaty).length === 0) {//There is no treaty in the channel
            message.channel.send("You cannot remove a signatory from a non-existent treaty. To make a new treaty, use ~make-treaty.");
            return;
        }
        if(! channelProfile.Item.curTreaty.signatories.hasOwnProperty(roleID)) {//Attempt to remove a non-signatory
            message.channel.send("The role provided was never a signatory.");
            return;
        }
        //Delete signatory
        delete channelProfile.Item.curTreaty.signatories[roleID];
        try {//Attempt to push to database
            await updateDB.updateTable('diploChannels', message.channel.id, 'curTreaty', channelProfile.Item.curTreaty);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        message.channel.send("Signatory removed successfully");
        
    }
}