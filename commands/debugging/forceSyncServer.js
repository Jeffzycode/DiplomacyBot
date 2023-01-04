const individualServerSyncer = require(`../../DMCommands/syncs/syncIndivServer.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);//Import sync for individual servers

module.exports = {    
    name: 'force-sync-server',
    description: "Force syncs the specific server to the database. Safe command.",
    requiredPerms: [],
    async execute(message, args){
        //Check permissions
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, true, message))) return;

        await individualServerSyncer.forceSyncServer(message.guild, message);//Force syncs this specific server
    }
}