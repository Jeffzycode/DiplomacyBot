require('dotenv').config()
const AWS = require('aws-sdk'), permVerifier = require(`../../QOL/permissionsChecker.js`), assert = require('assert'), CE = require(`../../QOL/commonErrors.js`);
const { PermissionsBitField } = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
    name: 'server-info',
    description: "Returns an embed with some information about the server",
    requiredPerms: [],
    async execute(message, args){
        //Perms checker
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let serverProfile;
        
        try {//Fetch role profile
            serverProfile = await docClient.get({TableName: 'servers', Key: {id: message.guild.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
        }
        //Fetch members, roles and channels
        await message.guild.fetch()
        await message.guild.members.fetch();
        await message.guild.roles.fetch();
        await message.guild.channels.fetch();
        await message.guild.invites.fetch();
        //Start building the embed
        let curEmbed = {
            color: Number('0x'+message.member.displayHexColor.slice(1)),
            title: message.guild.name,
            author: {
                name: message.guild.name,
                icon_url: message.guild.iconURL()
            },
            fields: [
                {
                    name: 'Created on',
                    value: message.guild.createdAt.toLocaleDateString("en-US", {year: 'numeric', month: 'long', day: 'numeric'}),
                    inline: true
                },
                {
                    name: 'Owner',
                    value: '<@' + message.guild.ownerId + '>',
                    inline: true
                },
                {
                    name: 'Members',
                    value: message.guild.memberCount,
                    inline: true
                },
                {
                    name: 'Channels',
                    value: message.guild.channels.channelCountWithoutThreads,
                    inline: true
                },
                {
                    name: 'Roles',
                    value: message.guild.roles.cache.size,
                    inline: true
                },
                {
                    name: 'Country Roles',
                    value: Object.keys(serverProfile.Item.countryRoles).length,
                    inline: true
                },
                {
                    name: 'Diplo Channels',
                    value: Object.keys(serverProfile.Item.diploChannels).length,
                    inline: true
                },
                {
                    name: 'Published Treaties',
                    value: Object.keys(serverProfile.Item.treaties).length,
                    inline: true
                },
                {
                    name: 'Invites',
                    value: message.guild.invites.cache.size,
                    inline: true
                },
                {
                    name: 'Treaty Output Channel',
                    value: (serverProfile.Item.treatyOutputChannel === 'NULL' ? 'Not set' : '<#' + serverProfile.Item.treatyChannel + '>'),
                    inline: true
                }
            ]
        }
        await message.channel.send({embeds: [curEmbed]});
    }
}