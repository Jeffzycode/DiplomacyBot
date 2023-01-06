require('dotenv').config()
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`), assert = require('assert'), CE = require(`../../QOL/commonErrors.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);
const {PermissionsBitField} = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

async function isRole(inStr, msg) {//Validates if the string is a role
    try{
        assert(inStr.length > 4);
        assert((await msg.guild.roles.fetch(inStr.substring(3, inStr.length-1))) !== null); //Check if the role exists
    } catch (error) {
        console.log(error);
        return false;
    }
    return true;
}

module.exports = {
    name: 'unset-country-roles',
    description: "Removes the country status from the role. Can handle multiple roles. Does NOT change permissions of diplomatic channels.",
    requiredPerms: [PermissionsBitField.Flags.ManageRoles],
    async execute(message, args){
        //Check perms
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let rolesToUnset = {};//Use Object to avoid duplicates
        try {//Input Format Validator
            assert(args.length > 0);
            for(i = 0; i < args.length; i++){
                assert(await isRole(args[i], message));//Validate role
                rolesToUnset[args[i].substring(3, args[i].length-1)] = true;
            }
        } catch (error) {
            await message.channel.send("Invalid Format. Use " + process.env.PFIX + "unset-country-roles @ROLE1 @ROLE2 ...");
            return;
        }
        let serverProfile;
        try {//Fetch server profile from the database
            serverProfile = await docClient.get({TableName: 'servers', Key: {id: message.guildId}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
        }
        try {//Other Validator (checking if each role is a country)
            for(roleID in rolesToUnset) assert(serverProfile.Item.countryRoles.hasOwnProperty(roleID));
        } catch (error){
            await message.channel.send("Error: each role must be a country role.");
            return;
        }
        let curCountryRoles = serverProfile.Item.countryRoles;
        try {//Unset roles
            for(roleID in rolesToUnset) {
                delete curCountryRoles[roleID];//Erase from server profile
                let data = await docClient.get({TableName: 'countryRoles', Key: {id: roleID}}).promise();//Pull role's information from countryRoles DB
                for(diploChannelID in data.Item.diploChannels) {//Erase from associated diploChannels
                    console.log(diploChannelID);
                    let __data = await docClient.get({TableName: 'diploChannels', Key: {id: diploChannelID}}).promise();
                    let assocMembers = __data.Item.members;
                    delete assocMembers[roleID];//Erase from associated diplo Channel
                    await updateDB.updateTable('diploChannels', diploChannelID, 'members', assocMembers);
                }
                await docClient.delete({TableName: 'countryRoles', Key: {id: roleID}}).promise();//Erase role from countryRoles DB
            }
            await updateDB.updateTable('servers', message.guildId, 'countryRoles', curCountryRoles);//Push changes to servers DB
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }  
        await message.channel.send("Un-set country roles successfully.");

    }
}