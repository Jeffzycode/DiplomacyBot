require('dotenv').config()
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`), assert = require('assert'), CE = require(`../../QOL/commonErrors.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);
const {PermissionsBitField} = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
    name: 'set-country-roles',
    description: "Adds the country status to the role. Can handle multiple roles now.",
    requiredPerms: [PermissionsBitField.Flags.ManageRoles],
    async execute(message, args){
        //Check perms
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let rolesToSet = [];
        console.log(args[0]);
        try {//Input format validator
            assert(args.length > 0);
            for(i = 0; i < args.length; i++){
                assert(args[i].length > 4);
                curRole = await message.guild.roles.fetch(args[i].substring(3, args[i].length-1));//Check if role exists
                assert(curRole !== null);
                rolesToSet.push(curRole.id);
            }
        } catch (error) {
            message.channel.send("Invalid format. Use ~set-country-role @Role1 @Role2 ...");
            return;
        }
        try {//Try to insert the new role into the server profile
            let data = await docClient.get({TableName: 'servers', Key: {id: message.guildId}}).promise(); //Update country list under the server profile
            let lstCountryRoles = data.Item.countryRoles;//Fetch existing list
            for(i = 0; i < rolesToSet.length; i++){//TODO: Log the country role in the countryRoles database
                if(lstCountryRoles.hasOwnProperty(rolesToSet[i])) continue;//Already exists, don't overwrite an existing country role
                const setParams = {//Log the country role in the countryRoles database
                    TableName: 'countryRoles',
                    Item:{
                        id: rolesToSet[i],
                        server: message.guildId,
                        diploChannels: {},
                        treaties: {}
                    }
                }
                await docClient.put(setParams).promise();
                lstCountryRoles[rolesToSet[i]] = true; //Insert the new country role in the server profile
            }
            await updateDB.updateTable('servers', message.guildId, 'countryRoles', lstCountryRoles);
        } catch (error){//Catch error
            console.log("Error when changing adding a role as a country, " + error);
            return;
        }
        message.channel.send("Succesfully updated country roles.");
    }
}