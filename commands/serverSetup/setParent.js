const assert = require('assert'), permVerifier = require(`../../QOL/permissionsChecker.js`), CE = require(`../../QOL/commonErrors.js`);
const {PermissionsBitField, ChannelType, PermissionFlagsBits} = require('discord.js');

module.exports = {
    name: 'set-parent',
    description: "Sets the parent of any channel to a specific category, or the parent of another channel.",
    requiredPerms: [PermissionsBitField.Flags.ManageChannels],
    async execute(message, args){
        //Check perms
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;

        let fetchedChannel, designatedParent;
        try {//Input validator
            assert(args.length === 2);
            //Validate that the first argument is a channel
            assert(args[0].length > 3);
            fetchedChannel = await message.guild.channels.fetch(args[0].substring(2, args[0].length-1));
            assert(fetchedChannel !== null);//Is a valid channel
            try {
                designatedParent = await message.guild.channels.fetch(args[1]);//Fetch the category directly
                assert(designatedParent !== null);//Found a channel
                assert(designatedParent.type === 4);//Must be a category
            } catch {
                assert(args[1].length > 3);
                designatedParent = await message.guild.channels.fetch(args[1].substring(2, args[1].length-1));//Fetch the category directly
                assert(designatedParent !== null);//Found a channel
                designatedParent = designatedParent.parent;//Get parent channel
            }
        } catch (error) {
            await message.channel.send("Invalid command. Use " + process.env.PFIX + "set-parent #CHANNEL <PARENT_ID> or " + process.env.PFIX + "set-parent #CHANNEL #CHILD");
            return;
        }
        //Change parent
        await fetchedChannel.setParent((designatedParent === null ? null : designatedParent.id), {lockPermissions: false});
        //Send confirmation message
        await message.channel.send("Successfully updated channel parent.");
    }
}