require('dotenv').config()
const AWS = require('aws-sdk'), CE = require(`../QOL/commonErrors.js`);

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();
module.exports = {
    name: 'guildDelete',
    async execute(guild){
        console.log("Kicked from the server " + guild.name);
        const params = {
            TableName: 'servers',
            Key: {
                id: guild.id
            }
        }
        try {//Delete diplo channels from the diploChannels database
            let data = await docClient.get(params).promise();
            for (channelID in data.Item.diploChannels) {//Delete diplo Channels from the database
                await docClient.delete({TableName: 'diploChannels', Key: {id: channelID}}).promise();
            }
        } catch (error) {
            console.log("Error when purging from diploChannels, " + error);
            return;
        }   
        try {//Delete country roles from countryRoles database
            let data = await docClient.get(params).promise();
            for (roleID in data.Item.countryRoles) {//Delete diplo Channels from the database
                await docClient.delete({TableName: 'countryRoles', Key: {id: roleID}}).promise();
            }
        } catch (error){
            console.log("Error when purging from countryRoles, " + error);
            return;
        }
        //TODO: delete treaties from respective databases
        try {//Delete treaties from treaties database
            let data = await docClient.get(params).promise();
            for(treatyID in data.Item.treaties){//Delete treaties from the database
                await docClient.delete({TableName: 'treaties', Key: {id: treatyID}}).promise();
            }
        } catch (error) {
            console.log("Error when purging from treaties, " + error);
            return;
        }
        //TODO: clean this up
        try {//Delete the server from the Servers table
            await docClient.delete(params).promise();
        } catch (error) {
            await CE.dataDeleteError(error);
        }
        console.log("Server profile for " + guild.name + " successfully deleted");
    }
}