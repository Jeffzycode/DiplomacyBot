require('dotenv').config();
const permVerifier = require(`../QOL/permissionsChecker.js`), roleChannelSyncer = require(`./syncs/syncRolesChannels.js`);


module.exports = {    
    name: 'force-sync-roles-channels',
    description: "Force syncs the countryRoles and diploChannels databases with each other. Also syncs the countryRoles database with the treaties database.",
    requiredPerms: [],
    async execute(user){
        //Perms checker (Restrict to devs)
        if(! (await permVerifier.checkPermissions(user, this.requiredPerms, true))) return;
        
        await roleChannelSyncer.execute(user);
    }
}