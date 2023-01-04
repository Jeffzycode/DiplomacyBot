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
    name: 'channel-info',
    description: "Returns an embed with information about the channel",
    requiredPerms: [],
    async execute(message, args){
        //Perms checker
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let fetchedChannel, channelProfile;
        try {//Input validator
            assert(args.length === 1);
            assert(args[0].length > 3);
            fetchedChannel = await message.guild.channels.fetch(args[0].substring(2, args[0].length-1));
            assert(fetchedChannel !== null);
        } catch (error) {
            await message.channel.send("Invalid command. Use ~role-info @ROLE");
        }
        try {//Fetch role profile
            channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: fetchedChannel.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
        }
        //Fetch to refresh members that can see the channel
        await message.guild.members.fetch();
        //Start building the embed
        console.log(fetchedChannel.name);
        let curEmbed = {
            color: Number('0x'+message.member.displayHexColor.slice(1)),
            title: '#'+fetchedChannel.name,
            author: {
                name: message.guild.name,
                icon_url: message.guild.iconURL()
            },
            fields: [
                {
                    name: 'Diplo Channel?',
                    value: (channelProfile.Item === undefined ? 'No' : 'Yes'),
                    inline: true
                },
                {
                    name: 'Members',
                    value: fetchedChannel.members.size,
                    inline: true
                }
            ]
        }
        if(channelProfile.Item === undefined) {//Not a diplo channel, send off the embed and continue on
            await message.channel.send({embeds: [curEmbed]});
            return;
        }
        let signatoryField = {
            name: 'Participating countries',
            value: '',
            inline: false
        };
        for(signatory in channelProfile.Item.members) signatoryField.value += '<@&' + signatory + '> ';//Add all signatory nations
        if(signatoryField.value.length > 0) signatoryField.value = signatoryField.value.substring(0, signatoryField.value.length-1);//Delete last character
        else signatoryField.value = 'Nobody, yet.'
        curEmbed.fields.push(signatoryField);
        await message.channel.send({embeds: [curEmbed]});

    }
}