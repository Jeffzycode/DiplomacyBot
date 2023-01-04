require('dotenv').config();
const assert = require('assert');
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`), CE = require(`../../QOL/commonErrors.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);
const {PermissionsBitField} = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {    
    name: 'unsign-treaty',
    description: "Unsigns a treaty on behalf of the roles the user has.",
    requiredPerms: [],
    async execute(message, args){
        //Perms checker (useless ATM)
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let channelProfile, rolesToRemove = [], rolesCache;
        try {//Fetch channel profile
            channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: message.channel.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
            return;
        }
        if(channelProfile.Item === undefined) {//Not a diplo channel
            message.channel.send("You cannot unsign a treaty in a non-diplo channel.");
            return;
        }
        if(Object.keys(channelProfile.Item.curTreaty).length === 0) {//There is no treaty in the channel
            message.channel.send("You cannot unsign a non-existent treaty. To make a new treaty, use ~make-treaty.");
            return;
        }
        rolesCache = message.member.roles.cache;
        for(let roleEntry of rolesCache){
            //If the user has a country role that is a signatory, add it to roleCache
            let roleID = roleEntry[0];
            if(channelProfile.Item.members.hasOwnProperty(roleID) && channelProfile.Item.curTreaty.signatories.hasOwnProperty(roleID)) rolesToRemove.push(roleID);
        }
        if(rolesToRemove.length === 0){//Don't waste resources pushing 
            message.channel.send("You weren't a signatory to begin with.");
            return;
        }
        //Delete signatories
        for(i = 0; i < rolesToRemove.length; i++) delete channelProfile.Item.curTreaty.signatories[rolesToRemove[i]];
        try {//Attempt to push to database
            await updateDB.updateTable('diploChannels', message.channel.id, 'curTreaty', channelProfile.Item.curTreaty);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        message.channel.send("Treaty un-signed successfully.");
        
    }
}