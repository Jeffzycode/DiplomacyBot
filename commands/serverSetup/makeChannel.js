const assert = require('assert'), permVerifier = require(`../../QOL/permissionsChecker.js`), CE = require(`../../QOL/commonErrors.js`);
const {PermissionsBitField, ChannelType, PermissionFlagsBits} = require('discord.js');

async function isRole(inStr, msg) {//Validates if the string is a role
    try{
        assert(inStr.length > 4);
        assert((await msg.guild.roles.fetch(inStr.substring(3, inStr.length-1))) !== null); //Check if the role exists
    } catch (error) {
        return false;
    }
    return true;
}


module.exports = {
    name: 'make-channel',
    description: "Creates a non-diplo, but possibly private channel.",
    requiredPerms: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageRoles],
    async execute(message, args){
        //Check perms
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let channelName = '', rolesWAccess = [];
        while(args.length > 0 && (await isRole(args[args.length-1], message))) {
            rolesWAccess.push(args[args.length-1].substring(3, args[args.length-1].length-1));
            args.pop();
        }
        if(args.length === 0) {//No channel name provided
            await message.channel.send("You must supply a channel name.");
            return;
        }
        channelName = args.join(' ');
        if(rolesWAccess.length === 0){//Create a public channel
            const createdChannel = await message.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText
            });
            await createdChannel.send("Successfully created channel.");
            return;
        }
        //Create private channel
        let channelParams = {
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: message.guild.roles.everyone,
                    deny: [PermissionFlagsBits.ViewChannel]
                }
            ]
        };
        for(i = 0; i < rolesWAccess; i++) channelParams.permissionOverwrites.push({id: rolesWAccess[i], allow: [PermissionFlagsBits.ViewChannel]});
        const createdChannel = await message.guild.channels.create(channelParams);
        //Send confirmation messages
        await createdChannel.send("Channel created successfully.");
        await message.channel.send("Successfully created channel <#" + createdChannel.id + ">.");
    }
}