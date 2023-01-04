require('dotenv').config()
const AWS = require('aws-sdk'), updateDB = require(`../QOL/updateDB.js`), CE = require(`../QOL/commonErrors.js`);

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();
module.exports = {
    name: 'roleDelete',
    async execute(role){
        //Check if the role was a country role
        try {
            let data = await docClient.get({TableName: 'servers', Key: {id: role.guild.id}}).promise();//Attempt to update server profile
            if(! data.Item.countryRoles.hasOwnProperty(role.id)) return;//Not a country role, stop checking
            let lstCountryRoles = data.Item.countryRoles;//Fetch existing list  
            delete lstCountryRoles[role.id];
            //Push updated country list to database
            await updateDB.updateTable('servers', role.guild.id, 'countryRoles', lstCountryRoles);//Attempt to write to the database
        } catch (error){
            await CE.databasePushError(error);
        }
        try {//First, attempt to erase role from diplo channels. Then, attempt to erase role from countryRoles DB
            let data = await docClient.get({TableName: 'countryRoles', Key: {id: role.id}}).promise();//Fetch role
            if(data.Item !== undefined) {
                for(diploChannel in data.Item.diploChannels) {//For each treaty channel the country role is a part of
                    let __data = await docClient.get({TableName: 'diploChannels', Key: {id: diploChannel}}).promise();
                    let lstChannelMembers = __data.Item.members;
                    delete lstChannelMembers[role.id];//Remove the role from the diplo channel
                    await updateDB.updateTable('diploChannels', diploChannel, 'members', lstChannelMembers); //Write to database
                }
            }
            await docClient.delete({TableName: 'countryRoles', Key: {id: role.id}}).promise();
        } catch (error) {
            await CE.dataDeleteError(error);
        }
        

        console.log("Successfully deleted role " + role.name);
    }
}