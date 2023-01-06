require('dotenv').config()
const AWS = require('aws-sdk'), assert = require('assert'), updateDB = require(`../../QOL/updateDB.js`), CE = require(`../../QOL/commonErrors.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);
const {PermissionsBitField } = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
    name: 'set-diplo-category',
    description: "Sets where diplo channels will be created, accepts either the ID of the category or a channel with the category as a parent",
    requiredPerms: [PermissionsBitField.Flags.ManageChannels],
    async execute(message, args){
        //Check perms
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        let newCategory = '';
        try {//Validator
            assert.equal(args.length, 1);
            try {//Try to fetch the category directly
                const fetchedChannel = await message.guild.channels.fetch(args[0]);
                assert(fetchedChannel !== null);//The category exists
                assert(fetchedChannel.type === 4);//Assert that this is a category 
                newCategory = fetchedChannel.id;
            } catch {//Attempt to get the parent of the channel
                assert(args[0].length > 3);
                assert((await message.guild.channels.fetch(args[0].substring(2, args[0].length-1))) !== null);//Must exist
                newCategory = (await message.guild.channels.fetch(args[0].substring(2, args[0].length-1))).parentId;
            }
        } catch (error) {
            await message.channel.send("Invalid command format. Use " + process.env.PFIX + "set-diplo-category <CATEGORY_ID> or\n" + process.env.PFIX + "set-diplo-category #CHANNEL_IN_TARGET_CATEGORY");
            console.log(error);
            return;
        }
        //Add diploCategory to database
        try {
            await updateDB.updateTable('servers', message.guildId, 'diploCategory', newCategory);
        } catch (error){
            await CE.databasePushError(error, message.channel);
        }
        await message.channel.send("Updated diplo category.");
    }
}