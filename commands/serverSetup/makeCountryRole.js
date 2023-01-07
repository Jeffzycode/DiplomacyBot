const AWS = require('aws-sdk'), assert = require('assert'), permVerifier = require(`../../QOL/permissionsChecker.js`), CE = require(`../../QOL/commonErrors.js`);
const {PermissionsBitField} = require('discord.js');
const updateDB = require('../../QOL/updateDB.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

function isColorCode(inputCode) {
    if(inputCode.length !== 7) return false;//Invalid length
    const R = parseInt(inputCode.substring(1, 3), 16), G = parseInt(inputCode.substring(3, 5), 16), B = parseInt(inputCode.substring(5, 7), 16);
    return (! isNaN(R) && ! isNaN(G) && ! isNaN(B) && R >= 0 && R <= 255 && G >= 0 && G <= 255 && B >= 0 && B <= 255);
}

module.exports = {
    name: 'make-country-role',
    description: "Creates a role and gives it the country status (it can be used to make diplomacy channels).",
    requiredPerms: [PermissionsBitField.Flags.ManageRoles],
    async execute(message, args){
        //Check perms
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let roleName = '', colorCode = '';
        if (args.length === 0) {//Validator
            await message.channel.send("Invalid command. Use " + process.env.PFIX + "make-country-role <ROLE_NAME> <#RRGGBB:OPTIONAL>");
            return;
        }
        if(args.length === 1 || ! isColorCode(args[args.length-1])) {
            roleName = args.join(' '); colorCode = '#' + Math.floor(Math.random()*16777215).toString(16);//Use supplied name and random colour
        } else {
            colorCode = args.pop(); roleName = args.join(' ');//Use supplied name and color code
        }
        if(roleName.length > process.env.MAX_ROLE_NAME_LENGTH) {//Provided name was too long
            await message.channel.send("The name of the role can have at most " + process.env.MAX_ROLE_NAME_LENGTH + " characters.");
            return;
        }
        //CREATE THE ROLE
        let createdRole = await message.guild.roles.create({
            name: roleName,
            color: '0x'+colorCode.substring(1),
            permissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.SendMessagesInThreads],
            mentionable: true
        });
        //LOG THE ROLE AS A COUNTRY ROLE
        //Fetch server profile
        let serverProfile;
        try {
            serverProfile = await docClient.get({TableName: 'servers', Key: {id: message.guild.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel); 
        }
        serverProfile.Item.countryRoles[createdRole.id] = true;
        //Make profile in countryRoles
        const setParams = {//Log the country role in the countryRoles database
            TableName: 'countryRoles',
            Item:{
                id: createdRole.id,
                server: message.guildId,
                diploChannels: {},
                treaties: {}
            }
        }
        try {//Create the country's profile in the database
            await docClient.put(setParams).promise();
        } catch (error) {
            await CE.dataCreateError(error, message.channel);
        }
        try {//Push changes to the server profile
            await updateDB.updateTable('servers', message.guild.id, 'countryRoles', serverProfile.Item.countryRoles);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        //Send confirmation message
        await message.channel.send("Successfully created the role <@&" + createdRole.id + '>.');
        
    }
}