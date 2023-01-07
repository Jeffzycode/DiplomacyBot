const AWS = require('aws-sdk'), assert = require('assert'), permVerifier = require(`../../QOL/permissionsChecker.js`), CE = require(`../../QOL/commonErrors.js`);
const {PermissionsBitField} = require('discord.js');
const updateDB = require('../../QOL/updateDB.js');

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


function isColorCode(inputCode) {
    if(inputCode.length !== 7) return false;//Invalid length
    const R = parseInt(inputCode.substring(1, 3), 16), G = parseInt(inputCode.substring(3, 5), 16), B = parseInt(inputCode.substring(5, 7), 16);
    return (! isNaN(R) && ! isNaN(G) && ! isNaN(B) && R >= 0 && R <= 255 && G >= 0 && G <= 255 && B >= 0 && B <= 255);
}

module.exports = {
    name: 'set-role-color',
    description: "Sets the colour of a role.",
    requiredPerms: [PermissionsBitField.Flags.ManageRoles],
    async execute(message, args){
        //Check perms
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let fetchedRole, colorCode = '';
        try {//Input validator
            assert(args.length === 2);
            assert(await isRole(args[0], message));
        } catch (error) {
            await message.channel.send("Invalid command. Use " + process.env.PFIX + "set-role-color @ROLE <#RRGGBB>");
            return;
        }
        //Fetch role
        fetchedRole = await message.guild.roles.fetch(args[0].substring(3, args[0].length-1));
        if(! isColorCode(args[1])) {//Not a colour
            await message.channel.send("Error: you must supply a Hex color code in the form #RRGGBB.");
            return;
        }
        await fetchedRole.setColor('0x' + args[1].substring(1));//Change colour
        //Send confirmation message
        await message.channel.send("Role color changed successfully");        
    }
}