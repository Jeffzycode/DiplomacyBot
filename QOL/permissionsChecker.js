require('dotenv').config();
/*
Simple permissions checker
- Being a bot dev will override the permissions check
*/
module.exports = {
    async checkPermissions(user, requiredPermissions, botDevNeeded = false, message = undefined){
        //User: a User object
        //requiredPermissions: an array of discord permissions required
        //botDevNeeded: whether only a bot dev can run the command
        //message: Allows fetching of permissions
        if(process.env.BOT_DEV_ID === user.id) return true;//Overridden by being a bot dev
        if(botDevNeeded) {
            if(message !== undefined) await message.channel.send("Sorry, you don't have the required permissions to do that.");
            return false;//User is not a bot dev
        }
        let userObj = await message.guild.members.fetch(user.id);
        for(i = 0; i < requiredPermissions.length; i++){
            if(userObj.permissions.has(requiredPermissions[i])) continue;//Passed
            if(message !== undefined) await message.channel.send("Sorry, you don't have the required permissions to do that.");
            return false;//User is missing a permission
        }
        return true;//User has the necessary permissions
    }
}