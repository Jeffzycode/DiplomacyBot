require('dotenv').config();
const permVerifier = require(`../QOL/permissionsChecker.js`), allServerSyncer = require(`./syncs/syncAllServers.js`), syncCleaner = require(`./syncs/syncClean.js`), roleChannelSyncer = require(`./syncs/syncRolesChannels.js`);

module.exports = {    
    name: 'force-sync-cycle',
    description: "Performs a full sync cycle. DM Command restricted to bot devs.",
    needsServerList: true,
    requiredPerms: [],
    async execute(serverList, user){
        //Perms checker (Restrict to devs)
        if(! (await permVerifier.checkPermissions(user, this.requiredPerms, true))) return;
        //Performs the three full syncs in order
        await (await user.fetch()).send("Starting full sync cycle.");
        await allServerSyncer.execute(serverList, user);
        await syncCleaner.execute(user);
        await roleChannelSyncer.execute(user);
        await (await user.fetch()).send("Finished full sync cycle.");
    }
}