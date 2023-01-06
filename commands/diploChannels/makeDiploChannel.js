require('dotenv').config()
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`), assert = require('assert'), CE = require(`../../QOL/commonErrors.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);
const { ChannelType, PermissionFlagsBits, PermissionsBitField } = require('discord.js');

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
        return false;
    }
    return true;
}

module.exports = {
    name: 'make-diplo',
    description: "Makes a diplomacy channel with variable args. Spaces accepted",
    requiredPerms: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageRoles],
    async execute(message, args){
        //Check perms
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let __name = "", __roles = [], __createdChannelID = "";
        try {//Input validator
            assert(args.length > 1);//Must contain a name and roles
            let isPastPost = false;//Parse            
            for(i = 0; i < args.length; i++){
                if(isPastPost) {//Add to roles
                    assert(await isRole(args[i], message));//Must be a role, otherwise format is invalid
                    __roles.push(args[i]); continue;
                }
                //Check if the argument is a role
                if(await isRole(args[i], message)) {//Add to roles
                    isPastPost = true; __roles.push(args[i]); continue;
                }
                //Add to name
                if(i > 0) __name += " ";
                __name += args[i];
            }
            assert(__name.length > 0 && __roles.length > 0);//Channel must have at least one role and name
        } catch (error) {
            await message.channel.send("Invalid command format. Use " + process.env.PFIX + "make-diplo <NAME> @ROLE1 @ROLE2 ...\nVerify that all of the roles are country roles, each separated by a space.");
            return;
        }
        //Check name length
        if(__name.length >= process.env.MAX_CHANNEL_TITLE_LENGTH) {
            await message.channel.send("You cannot name a channel something longer than " + process.env.MAX_CHANNEL_TITLE_LENGTH + " characters.");
            return;
        }
        //Check that all of the roles are country roles
        let countryRolesValid = true, channelParent = '';
        try {
            let data = await docClient.get({TableName: 'servers', Key: {id: message.guildId}}).promise();
            let lstCountryRoles = data.Item.countryRoles;
            for(i = 0; i < __roles.length; i++){
                if(! lstCountryRoles.hasOwnProperty(__roles[i].substring(3, __roles[i].length-1))) {
                    await message.channel.send("Error: cannot assign a non-country role to a diplo channel.");
                    countryRolesValid = false;
                    return;   
                }
            }
            if(data.Item.hasOwnProperty("diploCategory")) channelParent = data.Item.diploCategory;
        } catch (error) {//Error fetching country roles
            await CE.databaseFetchError(error, message.channel);
        }
        
        if(! countryRolesValid) return;//Halt execution, attempted to create a diplo channel involving a non-country role

        //Attempt to create the channel
        try {
            let channelParams = {
                name: __name,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: message.guild.roles.everyone,
                        deny: [PermissionFlagsBits.ViewChannel]
                    }
                ]
            }
            if(channelParent.length > 0) channelParams['parent'] = channelParent;//Set parent category if it exists
            let __roleList = [];//Make an array of promises to fetch the roles
            for(i = 0; i < __roles.length; i++) __roleList.push(await message.guild.roles.fetch(__roles[i].substring(3, __roles[i].length-1)));
            __roleList.forEach(role =>{
                channelParams.permissionOverwrites.push({
                    id: role,
                    allow: [PermissionFlagsBits.ViewChannel]
                })
            })
            await message.guild.channels.create(channelParams).then(channel => {
                __createdChannelID = channel.id;
                channel.send("Channel created.");
            });
        } catch (error){
            console.log(error);
            await message.channel.send("Failed to create channel. Please contact a developer.");
            return;
        }
        //Update databases
        //Attempt to push the channel to the server profile and the database channel
        try {
            //Step 1: Push to server profile
            let data = await docClient.get({TableName: 'servers', Key: {id: message.guildId}}).promise();
            let dipChannels = data.Item.diploChannels;
            dipChannels[__createdChannelID] = true;//Create entry
            await updateDB.updateTable('servers', message.guildId, 'diploChannels', dipChannels);

            //Step 2: Make an entry in the diploChannels database
            const params = {
                TableName: 'diploChannels',
                Item: {}
            }
            params.Item["id"] = __createdChannelID;//Set ID
            params.Item["server"] = message.guildId;//Set server path
            params.Item["curTreaty"] = {};//No current treaty
            params.Item["members"] = {};//Current members
            for(i = 0; i < __roles.length; i++) params.Item["members"][__roles[i].substring(3, __roles[i].length-1)] = true;//Add all members of the channel as signatories
            await docClient.put(params).promise();//Push to database

            //Step 3: Push the diplo channel to each country role's profile
            for(i = 0; i < __roles.length; i++) {
                let __data = await docClient.get({TableName: 'countryRoles', Key: {id: __roles[i].substring(3, __roles[i].length-1)}}).promise();
                let curDipChannels = __data.Item.diploChannels;
                curDipChannels[__createdChannelID] = true; //Insert
                await updateDB.updateTable('countryRoles', __roles[i].substring(3, __roles[i].length-1), 'diploChannels', curDipChannels);
            }

        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        await message.channel.send("Channel successfully created.");
        //TODO: Add channel to role profiles
    }
}