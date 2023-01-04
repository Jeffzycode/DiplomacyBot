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
    name: 'delete-clause',
    description: "Deletes a clause from the treaty currently being negotiated in the channel. Number provided is optional",
    requiredPerms: [],
    async execute(message, args){
        //Perms checker (useless ATM)
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        //Step 1. Validate command arguments
        let clauseToDelete = 0;
        try {
            assert(args.length === 0 || args.length === 1);
            if(args.length === 1){
                let parsedNum = Number(args[0]);
                assert(Number.isInteger(parsedNum) && parsedNum > 0);
                clauseToDelete = parsedNum;
            }
        } catch (error) {
            message.channel.send("Invalid command format. Use ~delete-clause <CLAUSE-NUMBER_(OPTIONAL)>");
            return;
        }
        //Step 2. Pull the channel entry from the database
        let channelProfile;
        try {//Fetch channel profile
            channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: message.channel.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
        }
        if(channelProfile.Item === undefined) {//Not a diplo channel
            message.channel.send("You cannot delete a clause from a treaty in a non-diplo channel.");
            return;
        }
        if(Object.keys(channelProfile.Item.curTreaty).length === 0) {//There is no treaty in the channel
            message.channel.send("You cannot delete a clause from a non-existent treaty. To make a new treaty, use ~make-treaty.");
            return;
        }
        if(channelProfile.Item.curTreaty.clauses.length === 0){//There are no clauses to delete
            message.channel.send("There is no clause to delete. Use ~add-clause to add a new clause.");
            return;
        }
        if(clauseToDelete === 0) clauseToDelete = channelProfile.Item.curTreaty.clauses.length; //No clause provided = delete lastClause
        //Step 3. Check that the clause exists
        if(channelProfile.Item.curTreaty.clauses.length < clauseToDelete) {//There is no treaty in the channel
            message.channel.send("You cannot delete a non-existent clause.");
            return;
        }
        //Step 4. Delete the clause
        channelProfile.Item.curTreaty.clauses.splice(clauseToDelete-1, 1);
        //Step 5. Push to database
        try {
            await updateDB.updateTable('diploChannels', message.channel.id, 'curTreaty', channelProfile.Item.curTreaty);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        message.channel.send("Clause successfully deleted.");
    }
}