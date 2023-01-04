require('dotenv').config();
const AWS = require('aws-sdk'), permVerifier = require(`../QOL/permissionsChecker.js`);
const individualServerSyncer = require(`./syncs/syncIndivServer.js`);//Import sync for individual servers

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

async function createServerProfile(serverID){//Returns 
    const params = {
        TableName: 'servers',
        Item: {}
    }
    //Provision Basic Info:
    params.Item["id"] = serverID;
    params.Item["diploChannelCount"] = 0;
    params.Item["treatyCount"] = 0;
    params.Item["countryRoleCount"] = 0;
    params.Item["diploChannels"] = {};//Empty Table
    params.Item["treaties"] = {};//Empty Table
    params.Item["countryRoles"] = {};//Empty Table
    params.Item["logChannel"] = "NULL"; //Set the log Channel
    params.Item["treatyChannel"] = "NULL";//Set the Treaty Output Channel
    console.log(params);//Debug log
    try {
        await docClient.put(params).promise();
    } catch (error) {
        console.log("Error creating server profile, " + error);
    }
    return params.Item;
}

async function deleteServer(serverID){
    //Safe command (assumes databases may be out of sync)
    const serverProfile = (await docClient.get({TableName: 'servers', Key: {id: serverID}}).promise()).Item; //Fetches server profile
    //Step 1: Delete all country roles associated with it
    for(countryRoleID in serverProfile.countryRoles) await docClient.delete({TableName: 'countryRoles', Key: {id: countryRoleID}}).promise();
    //Step 2: Delete all diplo channels associated with it
    for(diploChannelID in serverProfile.diploChannels) await docClient.delete({TableName: 'diploChannels', Key: {id: diploChannelID}}).promise();
    //Step 3: Delete all all treaties associated with it
    //TODO
    //Delete server profile
    await docClient.delete({TableName: 'servers', Key: {id: serverID}}).promise();
}

module.exports = {    
    name: 'force-sync-all-servers',
    description: "Force syncs all servers the bot is in. DM Command restricted to bot devs.",
    needsServerList: true,
    requiredPerms: [],
    async execute(serverList, user){
        //Perms checker (Restrict to devs)
        if(! (await permVerifier.checkPermissions(user, this.requiredPerms, true))) return;

        await (await user.fetch()).send("Starting Full Forced Sync.");
        await (await user.fetch()).send("Comparing database to discord.");
        //First checks if the bot is a member of every server in the database, deleting server databases when necessary.
        let searchParams = {
            TableName: 'servers'
        }
        let serversInDB = {}, serversToDelete = [], entriesDeleted = 0, entriesValidated = 0;//Empty array
        let queryResults;
        do {
            queryResults = await docClient.scan(searchParams).promise();
            queryResults.Items.forEach((server) => {serversInDB[server.id] = server;});
            searchParams.ExclusiveStartKey = queryResults.LastEvaluatedKey;
        } while(typeof queryResults.LastEvaluatedKey !== "undefined");
        
        for(serverID in serversInDB){//Iterate over objects
            entriesValidated++;
            if(serverList.has(serverID)) continue;//The bot is in this server
            await deleteServer(serverID);//Delete from the database
            delete serversInDB[serverID];//Delete this characteristic
            entriesDeleted++;
        }
        await (await user.fetch()).send(entriesValidated + " entries validated, " + entriesDeleted + " deleted from the database.");
        //Then checks if every server the bot is in has a corresponding profile in the server database.
        await (await user.fetch()).send("Comparing discord to database");
        let entriesCreated = 0, serversValidated = 0;
        for(let server of serverList) {
            let serverID = server[0];
            serversValidated++;
            if(serversInDB.hasOwnProperty(serverID)) continue;//Exists in database
            serversInDB[serverID] = await createServerProfile(serverID);//Make profile
            entriesCreated++;
        }
        await (await user.fetch()).send(serversValidated + " servers validated, " + entriesCreated + " new entries created in the database.");
        //Finally, force syncs each server profile with discord and the other three DBs.
        await (await user.fetch()).send("Force syncing each server with its database");
        let serversSynced = 0;
        for(let server of serverList) {
            await individualServerSyncer.forceSyncServer(await server[1].fetch());
            serversSynced++;
        }
        await (await user.fetch()).send("Force synced " + serversSynced + " servers successfully.");
    }
}