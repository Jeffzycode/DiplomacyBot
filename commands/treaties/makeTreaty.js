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
    name: 'make-treaty',
    description: "Creates a new treaty for the channel if it does not already exist.",
    requiredPerms: [],
    async execute(message, args){
        //Perms checker (useless ATM)
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let channelProfile;
        try {//Fetch channel profile
            channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: message.channel.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
        }
        if(channelProfile.Item === undefined) {//Not a diplo channel
            await message.channel.send("You cannot make a treaty in a non-diplo channel.");
            return;
        }
        if(Object.keys(channelProfile.Item.curTreaty).length !== 0) {//There is already a treaty in the channel
            await message.channel.send("A treaty exists in this channel. To delete it, use " + process.env.PFIX + "cancel-treaty.");
            return;
        }
        //Make the treaty
        //Set the title if it was provided
        let treatyTitle = '';
        for(i = 0; i < args.length; i++){
            if(i > 0) treatyTitle += " ";
            treatyTitle += args[i];
        }
        //Check title length
        if(treatyTitle.length > process.env.MAX_TREATY_TITLE_LENGTH) {
            await message.channel.send("The treaty's title can be at most " + process.env.MAX_TREATY_TITLE_LENGTH + " characters.");
            return;
        }
        //Make the treaty object
        let newTreaty = {
            title: treatyTitle,
            date: '',
            clauses: [],//Array
            signatories: {}//Object of signatories
        };
        try {
            await updateDB.updateTable('diploChannels', message.channel.id, 'curTreaty', newTreaty);
        } catch (error) {  
            await CE.databasePushError(error, message.channel);
        }
        await message.channel.send("Treaty succesfully created");
    }
}