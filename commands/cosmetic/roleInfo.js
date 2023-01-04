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
    name: 'role-info',
    description: "Returns an embed with information about the role",
    requiredPerms: [],
    async execute(message, args){
        //Perms checker
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let fetchedRole, roleProfile;
        try {//Input validator
            assert(args.length === 1);
            assert(args[0].length > 4);
            fetchedRole = await message.guild.roles.fetch(args[0].substring(3, args[0].length-1));
            assert(fetchedRole !== null);
        } catch (error) {
            await message.channel.send("Invalid command. Use ~role-info @ROLE");
            return;
        }
        try {//Fetch role profile
            roleProfile = await docClient.get({TableName: 'countryRoles', Key: {id: fetchedRole.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
            return;
        }
        //Perform a fetch to refresh members listed under the role
        await message.guild.members.fetch();
        let curEmbed = {
            color: Number('0x'+message.member.displayHexColor.slice(1)),
            title: fetchedRole.name,
            author: {
                name: message.guild.name,
                icon_url: message.guild.iconURL()
            },
            fields: [
                {
                    name: 'No. of users with role',
                    value: fetchedRole.members.size,
                    inline: true
                },
                {
                    name: 'Country Role?',
                    value: (roleProfile.Item === undefined ? 'No' : 'Yes'),
                    inline: true
                }
            ]
        }
        //Add members if they exist
        if(fetchedRole.members.size) {
            let memberField = {
                name: 'Members with this role:',
                value: '',
                inline: false
            }
            for(let member of fetchedRole.members) memberField.value += '<@' + member[0] + '>, ';
            memberField.value = memberField.value.substring(0, memberField.value.length-2);//Deletes last two characters
            curEmbed.fields.push(memberField);
        }
        await message.channel.send({embeds: [curEmbed]});
    }
}