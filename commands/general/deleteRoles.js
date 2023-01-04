const assert = require('assert'), permVerifier = require(`../../QOL/permissionsChecker.js`);
const {PermissionsBitField} = require('discord.js');

module.exports = {
    name: 'delete-roles',
    description: "Deletes one, possibly more roles",
    requiredPerms: [PermissionsBitField.Flags.ManageRoles],
    async execute(message, args){
        //Check Perms
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        //Dangerous command, should restrict
        let rolesToDelete = {};
        try {//Input validator
            assert(args.length >= 1);//Must contain at least one channel to delete
            for(i = 0; i < args.length; i++){
                assert(args[i].length > 4);//Avoid edge case with four chars
                fetchedRole = await message.guild.roles.fetch(args[i].substring(3, args[i].length-1));
                assert(fetchedRole !== null);//Role must exist
                rolesToDelete[fetchedRole.id] = true;
            }
        } catch (error) {
            message.channel.send("Invalid command format. Use ~delete-roles @ROLE1 @ROLE2 ...");
            console.log(error);            
            return;
        }

        try {//Attempt to delete roles
            let deleteCnt = 0;
            for(role in rolesToDelete) {
                await message.guild.roles.delete(role, 'Bulk Delete');
                deleteCnt++;
            }
            message.channel.send("Deleted " + deleteCnt + " role(s).");
        } catch (error) {
            message.channel.send("Error when deleting roles, contact a developer.");
            console.log(error);
            return;
        }
        
    }
}