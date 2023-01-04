require('dotenv').config()
const AWS = require('aws-sdk'), updateDB = require(`../QOL/updateDB.js`), CE = require(`../QOL/commonErrors.js`);

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();
module.exports = {
    name: 'channelDelete',
    async execute(guildChannel){
        //Check if the channel was the log channel
        let data;
        try {
            data = await docClient.get({TableName: 'servers', Key: {id: guildChannel.guildId}}).promise();
        } catch (error) {
            console.log("Error when fetching from database, " + error);
            return;//Halt process and exit
        }
        if(data.Item.logChannel === guildChannel.id) {//Log channel was deleted, reset the log channel
            await guildChannel.guild.channels.fetch();//Force fetch
            let txtChannels = await guildChannel.guild.channels.cache.filter(x => x.type == 0);
            let newLogChannel = "NULL";
            if(txtChannels.size !== 0) newLogChannel = txtChannels.at(0).id;//Switch log channel to the topmost log channel it has access to
            try {//Try pushing changes to database
                await updateDB.updateTable('servers', guildChannel.guildId, 'logChannel', newLogChannel);
            } catch(error) {
                await CE.databasePushError(error);
            }
            console.log("Successfully changed log channel of server " + guildChannel.guild.name);
            if(newLogChannel !== "NULL") await guildChannel.guild.channels.fetch(newLogChannel).then(channel => channel.send("Log Channel changed to this one."));
        }
        if(data.Item.treatyChannel === guildChannel.id){//Treaty Output Channel was deleted, reset the treaty channel
            await guildChannel.guild.channels.fetch();//Force fetch
            let txtChannels = guildChannel.guild.channels.cache.filter(x => x.type == 0);
            let newTreatyChannel = "NULL";
            if(txtChannels.size !== 0) newTreatyChannel = txtChannels.at(0).id;//Switch treaty channel to the topmost log channel it has access to
            try {//Push changes to database
                await updateDB.updateTable('servers', guildChannel.guildId, 'treatyChannel', newTreatyChannel);
            } catch (error) {
                await CE.databasePushError(error);
            }
            console.log("Successfully changed treaty channel of server " + guildChannel.guild.name);
            if(newTreatyChannel !== "NULL") await guildChannel.guild.channels.fetch(newTreatyChannel).then(channel => channel.send("Treaty Channel changed to this one."));
        }
        if(data.Item.diploCategory === guildChannel.id) {//Diplo category was deleted, delete the diplo category from database
            try {//Try pushing changes to database
                await updateDB.deleteAttribute('servers', guildChannel.guildId, 'diploCategory');
            } catch (error) {
                await CE.databasePushError(error);
            }
            console.log("Successfully deleted diplo category");
        }
        if(data.Item.archiveCategory === guildChannel.id) {//Archive category was deleted, delete the archive category from database
            try {
                await updateDB.deleteAttribute('servers', guildChannel.guildId, 'archiveCategory');
            } catch (error) {
                await CE.databasePushError(error);
            }

        }
        if(data.Item.diploChannels.hasOwnProperty(guildChannel.id)) {//Diplo channel was deleted, remove from database and server profile
            //Step 1: Remove it from each of its member country's channels (apply changes to countryRoles DB)
            try {
                let __data = await docClient.get({TableName: 'diploChannels', Key: {id: guildChannel.id}}).promise();//Fetch channel profile from database
                for(participCountry in __data.Item.members) {
                    //Delete the diplo channel from its members
                    let __prof = await docClient.get({TableName: 'countryRoles', Key: {id: participCountry}}).promise();//Fetch country role profile of its members
                    let curChannels = __prof.Item.diploChannels;
                    delete curChannels[guildChannel.id];
                    await updateDB.updateTable('countryRoles', participCountry, 'diploChannels', curChannels); //Push to database
                }
            } catch (__error) {
                await CE.databasePushError(__error);
            }
            //Step 2: Purge it from the diploChannels database (apply changes to diploChannels DB)
            try {   
                await docClient.delete({TableName: 'diploChannels', Key: {id: guildChannel.id}}).promise();
            } catch (__error){
                await CE.dataDeleteError(__error);
            }

            console.log("Successfully deleted diplo channel from the diploChannels table.");
            
            //Step 3: Purge it from the diploChannels subcategory
            let dipChannels = data.Item.diploChannels;//Fetch set of Diplo Channels
            delete dipChannels[guildChannel.id];//Delete channel
            try {//Push changes to database
                await updateDB.updateTable('servers', guildChannel.guildId, 'diploChannels', dipChannels);
            } catch(__error) {
                await CE.databasePushError(__error);
            }
            console.log("Successfully deleted diplo channel from the server entry.");
        }
    }
}