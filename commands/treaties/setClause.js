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
    name: 'set-clause',
    description: "Sets a clause to the treaty currently being negotiated in the channel.",
    requiredPerms: [],
    async execute(message, args){
        //Perms checker (useless ATM)
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        //Step 1. Validate input
        let clauseNumber, addedClause = '';
        try {
            assert(args.length >= 2);
            //Check that the first argument is a number greater than zero
            let parsedNum = Number(args[0]);
            assert(Number.isInteger(parsedNum) && parsedNum > 0);
            clauseNumber = parsedNum;
            for(i = 1; i < args.length; i++){
                if(i > 1) addedClause += ' ';
                addedClause += args[i];
            }
        } catch (error) {
            message.channel.send("Invalid command. Use ~set-clause <NUMBER> <CLAUSE>");
            return;
        }
        if(addedClause.length === 0){//Cannot set an empty clause
            message.channel.send("Cannot set a clause to be empty.");
            return;
        }
        //Check if the clause length is below the max length
        if(addedClause.length > process.env.MAX_CLAUSE_LENGTH) {
            message.channel.send("The maximum length of a clause is " + process.env.MAX_CLAUSE_LENGTH + " characters.");
            return;
        }
        //Step 2. Fetch the channel profile from DB
        let channelProfile;
        try {//Fetch channel profile
            channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: message.channel.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
            return;
        }
        if(channelProfile.Item === undefined) {//Not a diplo channel
            message.channel.send("You cannot set a clause in a non-diplo channel.");
            return;
        }
        if(Object.keys(channelProfile.Item.curTreaty).length === 0) {//There is no treaty in the channel
            message.channel.send("You cannot set a clause of a non-existent treaty. To make a new treaty, use ~make-treaty.");
            return;
        }
        //Step 3. Check that the given clause exists
        if(channelProfile.Item.curTreaty.clauses.length < clauseNumber) {//Trying to set a non-existent clause
            message.channel.send("You cannot set a non-existent clause.");
            return;
        }
        //Set changes to DB
        channelProfile.Item.curTreaty.clauses[clauseNumber-1] = addedClause;
        //Step 4. Push changes to DB
        try {//Attempt to push to database
            await updateDB.updateTable('diploChannels', message.channel.id, 'curTreaty', channelProfile.Item.curTreaty);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        message.channel.send("Successfully set clause no. " + clauseNumber);
    }
}