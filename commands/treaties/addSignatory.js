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
    name: 'add-signatory',
    description: "Forcibly adds a signatory to the treaty.",
    requiredPerms: [PermissionsBitField.Flags.Administrator],
    async execute(message, args){
        //TODO: restrict to admins only
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        //Step 1. Validate input, must contain one role
        let channelProfile, roleID;
        try {
            assert(args.length === 1);//Contains exactly one argument
            assert(args[0].length > 4);//Length validator
            roleID = args[0].substring(3, args[0].length-1);
            assert((await message.guild.roles.fetch(roleID)) !== null);//Check that the argument is indeed a role
        } catch (error) {
            message.channel.send("Invalid command. Use ~add-signatory @ROLE");
            return;
        }
        try {//Fetch channel profile
            channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: message.channel.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
        }
        if(channelProfile.Item === undefined) {//Not a diplo channel
            message.channel.send("You cannot add a signatory in a non-diplo channel.");
            return;
        }
        if(Object.keys(channelProfile.Item.curTreaty).length === 0) {//There is no treaty in the channel
            message.channel.send("You cannot add a signatory to a non-existent treaty. To make a new treaty, use ~make-treaty.");
            return;
        }
        if(! channelProfile.Item.members.hasOwnProperty(roleID)) {//Attempt to add a non-member
            message.channel.send("You cannot add a non-member of the diplo channel as a signatory. To add them to the diplo channel, use ~force-add.");
            return;
        }
        //Add signatory
        channelProfile.Item.curTreaty.signatories[roleID] = true;
        //Check that the number of signatories is below the upper limit
        if(Objects.keys(channelProfile.Item.curTreaty.signatories).length > process.env.MAX_SIGNATORIES) {
            message.channel.send("There can be at most " + process.env.MAX_SIGNATORIES + " signatories of one treaty.");
            return;
        }
        try {//Attempt to push to database
            await updateDB.updateTable('diploChannels', message.channel.id, 'curTreaty', channelProfile.Item.curTreaty);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        message.channel.send("Signatory added successfully");
        
    }
}