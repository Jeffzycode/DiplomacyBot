require('dotenv').config();
const AWS = require('aws-sdk');

//Iterates through the countryRoles, diploChannels, and treaties databases, deleting entries which point to a null server or aren't pointed to by the server.

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

async function validateRole(serverID, roleID){
    //First, check if the server the role points to exists
    let serverProfile = await docClient.get({TableName: 'servers', Key: {id: serverID}}).promise();
    if(serverProfile.Item === undefined) return false;//Doesn't point to an existing server
    //Next, check if the server points back to the role
    return serverProfile.Item.countryRoles.hasOwnProperty(roleID);
}

async function validateChannel(serverID, channelID){
    //First, check if the server the channel points to exists
    let serverProfile = await docClient.get({TableName: 'servers', Key: {id: serverID}}).promise();
    if(serverProfile.Item === undefined) return false;//Doesn't point to an existing server
    //Next, check if the server points back to the channel\
    return serverProfile.Item.diploChannels.hasOwnProperty(channelID);
}

async function validateTreaty(serverID, treatyID){//TODO
    //First, check if the server the treaty points to exists
    let serverProfile = await docClient.get({TableName: 'servers', Key: {id: serverID}}).promise();
    if(serverProfile.Item === undefined) return false;//Doesn't point to an existing server
    //Next, check if the server points back to the treaty
    return serverProfile.Item.treaties.hasOwnProperty(treatyID);
}

module.exports = {    
    async execute(user) {
        await (await user.fetch()).send("Starting forced clean operation for countryRoles, diploChannels, and treaties.");
        let processedRoles = 0, deletedRoles = 0, processedChannels = 0, deletedChannels = 0, processedTreaties = 0, deletedTreaties = 0;
        //First, checks countryRoles DB
        let searchParams = {
            TableName: 'countryRoles'
        }
        let rolesInDB = {}, queryResults;
        do{
            queryResults = await docClient.scan(searchParams).promise();
            queryResults.Items.forEach((role) => {rolesInDB[role.id] = role});
            searchParams.ExclusiveStartKey = queryResults.LastEvaluatedKey;
        } while(typeof queryResults.LastEvaluatedKey !== "undefined");
        
        for(role in rolesInDB){
            processedRoles++;
            if(await validateRole(rolesInDB[role].server, role)) continue;//Valid
            await docClient.delete({TableName: 'countryRoles', Key: {id: role}}).promise();//Invalid, delete
            deletedRoles++;
        }
        //Then, checks diploChannels DB
        searchParams = {
            TableName: 'diploChannels'
        }
        let channelsInDB = {};
        do{
            queryResults = await docClient.scan(searchParams).promise();
            queryResults.Items.forEach((channel) => {channelsInDB[channel.id] = channel});
            searchParams.ExclusiveStartKey = queryResults.LastEvaluatedKey;
        } while(typeof queryResults.LastEvaluatedKey !== "undefined");
        
        for(channel in channelsInDB){
            processedChannels++;
            if(await validateChannel(channelsInDB[channel].server, channel)) continue;//Valid
            await docClient.delete({TableName: 'diploChannels', Key: {id: channel}}).promise();//Invalid, delete
            deletedChannels++;
        }
        //Finally, checks treaties DB
        searchParams = {
            TableName: 'treaties'
        }
        let treatiesInDB = {};
        do {
            queryResults = await docClient.scan(searchParams).promise();
            queryResults.Items.forEach((treaty) => {treatiesInDB[treaty.id] = treaty});
            searchParams.ExclusiveStartKey = queryResults.LastEvaluatedKey;
        } while(typeof queryResults.LastEvaluatedKey !== "undefined");

        for(treaty in treatiesInDB){
            processedTreaties++;
            if(await validateTreaty(treatiesInDB[treaty].server, treaty)) continue;//Valid
            await docClient.delete({TableName: 'treaties', Key: {id: treaty}}).promise();//Invalid, delete
            deletedTreaties++;
        }
        //Conf messages
        await (await user.fetch()).send("Scanned " + processedRoles + " role profiles and deleted " + deletedRoles + " of them.");
        await (await user.fetch()).send("Scanned " + processedChannels + " diplo channels and deleted " + deletedChannels + " of them.");
        await (await user.fetch()).send("Scanned " + processedTreaties + " treaties and deleted " + deletedTreaties + " of them.");
    }
}