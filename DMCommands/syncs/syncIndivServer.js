require('dotenv').config()
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`);

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})


/*
Syncs an individual server's profile with discord and the countryRoles, diploChannels, and treaties databases.
Assumptions:
- A profile exists in the servers database for the server being synced
*/

const docClient = new AWS.DynamoDB.DocumentClient();

async function deleteEntry(nameOfTable, itemKey, attrib) {
    /**
    nameOfTable: Name of the Table to write to (EG: servers, diploChannels, etc.)
    itemKey: Key of the Item being removed
    attrib: Header of the characteristic being removed (EG: members, curTreaty, etc.)
    **/
    const updateParams = {//Makes table with characteristic
        TableName: nameOfTable,
        Key: {
            id: itemKey
        },
        UpdateExpression: "remove #itemAttrib",
        ExpressionAttributeNames: {
            "#itemAttrib": attrib
        }
    }
    await docClient.update(updateParams).promise();//Push changes
}

async function deleteCountryRole(countryRoleID){
    //Basically updates all of the databases except the server database
    //Deletes from diploChannels database
    let countryEntry = (await docClient.get({TableName: 'countryRoles', Key: {id: countryRoleID}}).promise()).Item;
    if(countryEntry === undefined) return;//Was never a part of the database/Out of sync
    for(diploChannelID in countryEntry.diploChannels){
        let diploChannelProfile = (await docClient.get({TableName: 'diploChannels', Key: {id: diploChannelID}}).promise()).Item;
        if(diploChannelProfile === undefined) continue;//Out of sync, continue checking
        delete diploChannelProfile.members[countryRoleID];//Delete records of country
        await updateDB.updateTable('diploChannels', diploChannelID, 'members', diploChannelProfile.members);//Force delete
    }
    //Delete from countryRoles DB
    await docClient.delete({TableName: 'countryRoles', Key: {id: countryRoleID}}).promise();
    
}

async function deleteDiploChannel(diploChannelID){
    //Basically updates all of the databases except the server database
    let channelEntry = (await docClient.get({TableName: 'diploChannels', Key: {id: diploChannelID}}).promise()).Item;
    if(channelEntry === undefined) return;//Was never a part of the database/Out of sync
    for(countryRoleID in channelEntry.members){
        let countryRoleProfile = (await docClient.get({TableName: 'countryRoles', Key: {id: countryRoleID}}).promise()).Item;
        if(countryRoleProfile === undefined) continue;//Out of sync, continue checking
        delete countryRoleProfile.diploChannels[diploChannelID];//Delete records of channel
        await updateDB.updateTable('countryRoles', countryRoleID, 'diploChannels', countryRoleProfile.diploChannels);//Force delete
    }
    //Delete from diploChannels DB
    await docClient.delete({TableName: 'diploChannels', Key: {id: diploChannelID}}).promise();
}

async function deleteTreaty(treatyID){
    let treatyEntry = (await docClient.get({TableName: 'treaties', Key: {id: treatyID}}).promise()).Item;
    if(treatyID === undefined) return;//Was never a part of the database/Out of sync
    for(countryRoleID in treatyEntry.signatories){
        let countryRoleProfile = (await docClient.get({TableName: 'countryRoles', Key: {id: countryRoleID}}).promise()).Item;
        if(countryRoleProfile === undefined) continue;//Out of sync or country role was deleted, continue checking
        delete countryRoleProfile.treaties[treatyID];//Delete records of the treaty
        await updateDB.updateTable('countryRoles', countryRoleID, 'treaties', countryRoleProfile.treaties);//Force delete
    }
    //Delete from treaties DB
    await docClient.delete({TableName: 'treaties', Key: {id: treatyID}}).promise();
}

module.exports = {
    async forceSyncServer(guild, message = undefined){//Syncs a server's DB with discord and other databases
        if(message !== undefined) await message.channel.send("Started forced server sync for " + guild.name);
        
        let serverProfile;
        try {//Fetch server profile from the database
            serverProfile = await docClient.get({TableName: 'servers', Key: {id: guild.id}}).promise();
        } catch (error) {
            console.log("Error when fetching from database, " + error);
            return;
        }
        if(message !== undefined) await message.channel.send("Fetched server profile from database");
        //Check that server profile was found
        try {
            let assert = require('assert');
            assert(serverProfile.Item !== undefined);
        } catch (error){
            if(message !== undefined) message.channel.send("Server database out of sync. Full force sync recommended");
            console.log("Server database out of sync, " + error);
            return;
        }
        //Collections
        let curCountryRoles = serverProfile.Item.countryRoles, curDiploChannels = serverProfile.Item.diploChannels, curTreaties = serverProfile.Item.treaties;
        //Verify Collections
        try {
            //First, verify country roles:
            for(countryRole in curCountryRoles) {
                //Check if the country role exists in the server itself
                if(! (await guild.roles.fetch()).has(countryRole)) {
                    await deleteCountryRole(countryRole);//Role doesn't exist anymore.
                    delete curCountryRoles[countryRole];//Delete from object
                    continue;
                }
                let countryEntry = (await docClient.get({TableName: 'countryRoles', Key: {id: countryRole}}).promise()).Item;
                if(countryEntry === undefined) {
                    await deleteCountryRole(countryRole);//Doesn't have a profile in the countryRoles DB
                    delete curCountryRoles[counryRole];//Delete from object
                }
            }
            //Next, verify diplo channels
            for(diploChannel in curDiploChannels){
                if(! (await guild.channels.fetch()).has(diploChannel)) {
                    await deleteDiploChannel(diploChannel);//Channel doesn't exist anymore
                    delete curDiploChannels[diploChannel];//Delete from object
                    continue;
                }
                let channelEntry = (await docClient.get({TableName: 'diploChannels', Key: {id: diploChannel}}).promise()).Item;
                if(channelEntry === undefined){
                    await deleteDiploChannel(diploChannel);
                    delete curDiploChannels[diploChannel];//Delete from object
                }
            }
            //TODO: verify treaty Channels
            for(treaty in curTreaties){
                let treatyEntry = (await docClient.get({TableName: 'treaties', Key: {id: treaty}}).promise()).Item;
                if(treatyEntry === undefined){
                    await deleteTreaty(treaty);
                    delete curTreaties[treaty];//Delete from object
                }
            }
            //Push changes to the database
            await updateDB.updateTable('servers', guild.id, 'countryRoles', curCountryRoles);
            await updateDB.updateTable('servers', guild.id, 'diploChannels', curDiploChannels);
            await updateDB.updateTable('servers', guild.id, 'treaties', curTreaties);
        } catch (error) {
            console.log("Error when verifying collections, " + error);
            return;
        }
    
        //Singletons
        let curDiploCategory = serverProfile.Item.diploCategory, curTreatyChannel = serverProfile.Item.treatyChannel, curLogChannel = serverProfile.Item.logChannel;
        //Validate Singletons
        try {
            //Validate DiploCategory
            if(curDiploCategory !== undefined){//Exists
                //Invalid category, or category no longer exists
                if(! (await guild.channels.fetch()).has(curDiploCategory) || (await guild.channels.fetch(curDiploCategory)).type !== 4) await deleteEntry('servers', guild.id, 'diploCategory');
            }
            //Validate treaty channel
            if(curTreatyChannel !== "NULL"){//Exists
                //Invalid channel, or channel no longer exists
                if(! (await guild.channels.fetch()).has(curTreatyChannel) || (await guild.channels.fetch(curTreatyChannel)).type !== 0) await updateDB.updateTable('servers', guild.id, 'treatyChannel', 'NULL');
            }
            if(curLogChannel !== "NULL"){//Exists
                //Invalid channel, or channel no longer exists
                if(! (await guild.channels.fetch()).has(curLogChannel) || (await guild.channels.fetch(curLogChannel)).type !== 0) await updateDB.updateTable('servers', guild.id, 'logChannel', 'NULL');
            }
        } catch (error) {
            console.log("Error when validating singletons, " + error);
            return;
        }
        if(message !== undefined) message.channel.send("Finished server sync for " + guild.name);
    }
}
