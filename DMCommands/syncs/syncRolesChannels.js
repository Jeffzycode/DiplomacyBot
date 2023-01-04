require('dotenv').config();
const AWS = require('aws-sdk'), individualRoleSyncer = require(`./syncIndivRole.js`), individualChannelSyncer = require(`./syncIndivChannel.js`);//Import syncs

//Force syncs the countryRoles and diploChannels databases with each other. Also syncs the countryRoles database with the treaties database.

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
    async execute(user){ 
        await (await user.fetch()).send("Starting forced sync for countryRoles and diploChannels.");
        //First, force syncs each individual role in the coutryRoles database
        let searchParams = {
            TableName: 'countryRoles'
        }
        let rolesInDB = {}, queryResults;
        do {
            queryResults = await docClient.scan(searchParams).promise();
            queryResults.Items.forEach((role) => {rolesInDB[role.id] = role; });//Push roles
            searchParams.ExclusiveStartKey = queryResults.LastEvaluatedKey;
        } while(typeof queryResults.LastEvaluatedKey !== "undefined");
        let roleVerifiedCnt = 0;
        for(role in rolesInDB){
            await individualRoleSyncer.forceSyncRole(role);//Force sync the role
            roleVerifiedCnt++;
        }
        //Next, force syncs each individual channel in the diploChannels database
        searchParams = {
            TableName: 'diploChannels'
        }
        let channelsInDB = {};
        do {
            queryResults = await docClient.scan(searchParams).promise();
            queryResults.Items.forEach((channel) => {channelsInDB[channel.id] = channel; });//Push roles
            searchParams.ExclusiveStartKey = queryResults.LastEvaluatedKey;
        } while(typeof queryResults.LastEvaluatedKey !== "undefined");  
        let channelVerifiedCnt = 0;
        for(channel in channelsInDB){
            await individualChannelSyncer.forceSyncChannel(channel);
            channelVerifiedCnt++;
        }
        await (await user.fetch()).send("Verified " + channelVerifiedCnt + " channels and " + roleVerifiedCnt + " roles.");
        
    }
}