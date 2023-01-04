require('dotenv').config()
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`);

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

/*
Syncs an individual channel's profile from diploChannels database with the countryRoles database.
Assumptions:
- A profile exists for the channel being synced in the diploChannels database
*/

async function isValidRole(channelID, roleID){
    //First check if the role exists
    let roleProfile = await docClient.get({TableName: 'countryRoles', Key: {id: roleID}}).promise();
    if(roleProfile.Item === undefined) return false;
    //Next, check if the role points back to the channel
    return roleProfile.Item.diploChannels.hasOwnProperty(channelID);
}

module.exports = {
    async forceSyncChannel(channel) {//channel is the channel ID, NOT AN OBJECT!!!
        let channelProfile;
        try {//Fetch role profile from the database
            channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: channel}}).promise();
        } catch (error) {
            console.log("Error when fetching from database, " + error);
            return;
        }
        try {//Check to see if role was successfully fetched
            let assert = require('assert');
            assert(channelProfile.Item !== undefined);
        } catch (error) {
            console.log("Channel profile does not exist, full sync recommended. " + error);
            return;
        }
        let countryRoles = channelProfile.Item.members;
        try {//Verify each diploChannel
            for(roleID in countryRoles){
                if(await isValidRole(channel, roleID)) continue;//valid role, move on
                delete countryRoles[roleID];//Invalid, delete
            }
        } catch (error) {
            console.log("Error when verifying country roles, " + error);
            return;
        }
        try {//Push to database
            await updateDB.updateTable('diploChannels', channel, 'members', countryRoles);
        } catch (error) {
            console.log("Error when pushing to database, " + error);
            return;
        }
    }
}