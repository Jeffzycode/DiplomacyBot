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
    name: 'insert-clause',
    description: "Inserts a clause into the treaty at the given position, pushing other clauses back.",
    requiredPerms: [],
    async execute(message, args){
        //Perms checker (useless ATM)
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        //Step 1. Validate input
        let clauseNumber, insertedClause = '';
        try {
            assert(args.length >= 2);
            //Check that the first argument is a number greater than zero
            let parsedNum = Number(args[0]);
            assert(Number.isInteger(parsedNum) && parsedNum > 0);
            clauseNumber = parsedNum;
            for(i = 1; i < args.length; i++){
                if(i > 1) insertedClause += ' ';
                insertedClause += args[i];
            }
        } catch (error) {
            await message.channel.send("Invalid command. Use " + process.env.PFIX + "set-clause <NUMBER> <CLAUSE>");
            return;
        }
        if(insertedClause.length === 0){//Cannot insert an empty clause
            await message.channel.send("Cannot set a clause to be empty.");
            return;
        }
        //Check clause length
        if(insertedClause.length > process.env.MAX_CLAUSE_LENGTH) {
            await message.channel.send("The maximum length of a clause is " + process.env.MAX_CLAUSE_LENGTH + " characters.");
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
            await message.channel.send("You cannot insert a clause in a non-diplo channel.");
            return;
        }
        if(Object.keys(channelProfile.Item.curTreaty).length === 0) {//There is no treaty in the channel
            await message.channel.send("You cannot insert a clause into a non-existent treaty. To make a new treaty, use " + process.env.PFIX + "make-treaty.");
            return;
        }
        //Step 3. Check that the position is valid
        if(channelProfile.Item.curTreaty.clauses.length < clauseNumber) {//Trying to insert into an invalid position
            await message.channel.send("You cannot insert a clause into an invalid position.");
            return;
        }
        //Set changes to DB
        channelProfile.Item.curTreaty.clauses.splice(clauseNumber-1, 0, insertedClause);
        //Check that the number if clauses is not above the maximum number of allowed clauses
        if(channelProfile.Item.curTreaty.clauses.length > process.env.MAX_CLAUSES) {
            await message.channel.send("There can be a maximum of " + process.env.MAX_CLAUSES + " clauses in a single treaty.");
            return;
        }
        //Step 4. Push changes to DB
        try {//Attempt to push to database
            await updateDB.updateTable('diploChannels', message.channel.id, 'curTreaty', channelProfile.Item.curTreaty);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        await message.channel.send("Successfully inserted a clause into position no. " + clauseNumber);
    }
}