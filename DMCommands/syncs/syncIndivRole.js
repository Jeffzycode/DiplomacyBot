require('dotenv').config();
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`), assert = require('assert');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

/*
Syncs an individual role's profile from countryRoles database with the diploChannels database and the treaties database.
Assumptions:
- A profile exists for the role being synced in the countryRoles database
*/
async function isValidChannel(roleID, channelID){
    //First, check if channelID is in the diploChannels DB
    let channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: channelID}}).promise();
    if(channelProfile.Item === undefined) return false;//Doesn't exist
    //Next, check if diploChannelsDB points back to channelID
    return channelProfile.Item.members.hasOwnProperty(roleID);
}

async function isValidTreaty(roleID, treatyID){
    //First, check if treatyID is in the treaties DB
    let treatyProfile = await docClient.get({TableName: 'treaties', Key: {id: treatyID}}).promise();
    if(treatyProfile.Item === undefined) return false;//Doesn't exist
    //Next, check if diploChannelsDB points back to the role
    return treatyProfile.Item.signatories.hasOwnProperty(roleID);
}

module.exports = {
    async forceSyncRole(role) {//role is the role ID, not an object!!!
        let roleProfile;
        try {//Fetch role profile from the database
            roleProfile = await docClient.get({TableName: 'countryRoles', Key: {id: role}}).promise();
        } catch (error) {
            console.log("Error when fetching from database, " + error);
            return;
        }
        try {//Check to see if role was successfully fetched
            assert(roleProfile.Item !== undefined);
        } catch (error) {
            console.log("Role profile does not exist, full sync recommended. " + error);
            return;
        }
        let diploChannels = roleProfile.Item.diploChannels;
        try {//Verify each diploChannel
            for(diploChannelID in diploChannels){
                if(await isValidChannel(role, diploChannelID)) continue;//Valid
                delete diploChannels[diploChannelID];//Invalid, delete
            }
        } catch (error) {
            console.log("Error when verifying diplo channels, " + error);
            return;
        }
        try {//Push changes to database
            await updateDB.updateTable('countryRoles', role, 'diploChannels', diploChannels);
        } catch (error) {
            console.log("Error when pushing to database, " + error);
            return;
        }
        let treaties = roleProfile.Item.treaties;
        try {
            for(treatyID in treaties){
                if(await isValidTreaty(role, treatyID)) continue;//Valid
                delete treaties[treatyID];//Invalid, delete
            }
        } catch (error) {
            console.log("Error when verifying treaties, " + error);
        }
        try {//Push changes to database
            await updateDB.updateTable('countryRoles', role, 'treaties', treaties);
        } catch (error) {
            console.log("Error when pushing to database, " + error);
            return;
        }
    }
}