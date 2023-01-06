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
    name: 'set-date',
    description: "Sets the date of the treaty, in the format YYYY-MM-DD.",
    requiredPerms: [],
    async execute(message, args){
        //Perms checker (useless ATM)
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        //Step 1. Validate command & validate date
        let newDate;
        try {
            assert(args.length === 1);
            let parsedDate = new Date(args[0]);
            newDate = parsedDate.toISOString().split('T')[0];
        } catch (error) {
            await message.channel.send("Invalid command. Use " + process.env.PFIX + "set-date YYYY-MM-DD");
            return;
        }
        //Step 2. Fetch channel profile
        try {//Fetch channel profile
            channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: message.channel.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
            return;
        }
        //Step 3. Check that a treaty exists
        if(channelProfile.Item === undefined) {//Not a diplo channel
            await message.channel.send("You cannot set the treaty date in a non-diplo channel.");
            return;
        }
        if(Object.keys(channelProfile.Item.curTreaty).length === 0) {//There is no treaty in the channel
            await message.channel.send("You cannot set the date of a non-existent treaty. To make a new treaty, use " + process.env.PFIX + "make-treaty.");
            return;
        }
        //Step 4. Apply modification
        channelProfile.Item.curTreaty.date = newDate;
        //Step 5. Push to database
        try {//Attempt to push to database
            await updateDB.updateTable('diploChannels', message.channel.id, 'curTreaty', channelProfile.Item.curTreaty);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        await message.channel.send("Successfully set treaty date as " + newDate);
    }
}