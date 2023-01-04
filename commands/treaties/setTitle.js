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
    name: 'set-title',
    description: "Sets the title of the treaty currently being negotiated in the channel.",
    requiredPerms: [],
    async execute(message, args){
        //Perms checker (useless ATM)
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        if(args.length === 0) {//Must have at least one argument 
            message.channel.send("You cannot set an empty title.");
            return;
        }
        let setTitle = '';
        for(i = 0; i < args.length; i++) {
            if(i > 0) setTitle += ' ';
            setTitle += args[i];
        }
        //Check title length
        if(setTitle.length > process.env.MAX_TREATY_TITLE_LENGTH) {
            message.channel.send("The title of a treaty is limited to " + process.env.MAX_TREATY_TITLE_LENGTH + " characters.");
            return;
        }
        let channelProfile;
        try {//Fetch channel profile
            channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: message.channel.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
            return;
        }
        if(channelProfile.Item === undefined) {//Not a diplo channel
            message.channel.send("You cannot set a treaty title in a non-diplo channel.");
            return;
        }
        if(Object.keys(channelProfile.Item.curTreaty).length === 0) {//There is no treaty in the channel
            message.channel.send("You cannot set the title of a non-existent treaty. To make a new treaty, use ~make-treaty.");
            return;
        }
        channelProfile.Item.curTreaty.title = setTitle;//Add the title
        try {//Attempt to push to database
            await updateDB.updateTable('diploChannels', message.channel.id, 'curTreaty', channelProfile.Item.curTreaty);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        message.channel.send("Successfully set treaty title");
    }
}