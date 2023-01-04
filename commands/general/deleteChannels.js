const assert = require('assert'), permVerifier = require(`../../QOL/permissionsChecker.js`);
const {PermissionsBitField} = require('discord.js');

module.exports = {
    name: 'delete-channels',
    description: "Deletes one, possibly more channels",
    requiredPerms: [PermissionsBitField.Flags.ManageChannels],
    async execute(message, args){
        //Check perms
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        //Dangerous command, should restrict
        let channelsToDelete = {};
        try {//Input validator
            assert(args.length >= 1);//Must contain at least one channel to delete
            for(i = 0; i < args.length; i++){
                assert(args[i].length > 3);
                fetchedChannel = await message.guild.channels.fetch(args[i].substring(2, args[i].length-1));
                assert(fetchedChannel !== null);//Channel must exist
                channelsToDelete[fetchedChannel.id] = true;
            }
        } catch (error) {
            message.channel.send("Invalid command format. Use ~delete-channels #CHANNEL1 #CHANNEL2 ...");
            console.log(error);            
            return;
        }
        //Delete channels
        try{
            let deletedCnt = 0;
            for(curChannel in channelsToDelete) {
                await message.guild.channels.delete(curChannel, 'Bulk Delete');
                deletedCnt++;
            }
            //After the channels are deleted, print the number of channels deleted.
            try {
                await message.channel.send("Deleted " + deletedCnt + " channel(s).");    
            } catch (error) {
                console.log("Failed to send confirmation message");
            }
            
        } catch (error) {
            message.channel.send("Error when deleting channels, contact a developer.");
            console.log(error);
            return;
        }
        
        
    }
}