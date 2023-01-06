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
    name: 'add-clause',
    description: "Adds a clause to the treaty currently being negotiated in the channel",
    requiredPerms: [],
    async execute(message, args){
        //Perm checker
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let addedClause = '';
        for(i = 0; i < args.length; i++) {
            if(i > 0) addedClause += ' ';
            addedClause += args[i];
        }
        if(addedClause.length === 0){//Clause cannot be empty
            await message.channel.send("You cannot add an empty clause");
            return;
        }
        //Check if the clause length is below the limit
        if(addedClause.length > process.env.MAX_CLAUSE_LENGTH) {
            await message.channel.send("A clause can have a maximum of " + process.env.MAX_CLAUSE_LENGTH + " characters.");
            return;
        }
        let channelProfile;
        try {//Fetch channel profile
            channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: message.channel.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
        }
        if(channelProfile.Item === undefined) {//Not a diplo channel
            await message.channel.send("You cannot add a clause to a treaty in a non-diplo channel.");
            return;
        }
        if(Object.keys(channelProfile.Item.curTreaty).length === 0) {//There is no treaty in the channel
            await message.channel.send("You cannot add a clause to a non-existent treaty. To make a new treaty, use " + process.env.PFIX + "make-treaty.");
            return;
        }
        channelProfile.Item.curTreaty.clauses.push(addedClause);//Add the clause
        //Check that there aren't too many clauses
        if(channelProfile.Item.curTreaty.clauses.length > process.env.MAX_CLAUSES) {
            await message.channel.send("There can be at most " + process.env.MAX_CLAUSES + " clauses in a given treaty.");
            return;
        }
        try {//Attempt to push to database
            await updateDB.updateTable('diploChannels', message.channel.id, 'curTreaty', channelProfile.Item.curTreaty);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        await message.channel.send("Successfully added clause");
    }
}