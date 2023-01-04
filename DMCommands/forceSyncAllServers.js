require('dotenv').config();
const permVerifier = require(`../QOL/permissionsChecker.js`), allServerSyncer = require(`./syncs/syncAllServers.js`);

module.exports = {    
    name: 'force-sync-all-servers',
    description: "Force syncs all servers the bot is in. DM Command restricted to bot devs.",
    needsServerList: true,
    requiredPerms: [],
    async execute(serverList, user){
        //Perms checker (Restrict to devs)
        if(! (await permVerifier.checkPermissions(user, this.requiredPerms, true))) return;

        await allServerSyncer.execute(serverList, user);
    }
}