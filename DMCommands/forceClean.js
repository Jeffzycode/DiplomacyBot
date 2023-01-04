require('dotenv').config();
const syncCleaner = require(`./syncs/syncClean.js`), permVerifier = require(`../QOL/permissionsChecker.js`);

module.exports = {    
    name: 'force-clean',
    description: "Iterates through the countryRoles, diploChannels, and treaties databases, deleting entries which point to a null server or aren't pointed to by the server.",
    requiredPerms: [],
    async execute(user) {
        //Perms checker (Restrict to devs)
        if(! (await permVerifier.checkPermissions(user, this.requiredPerms, true))) return;
        
        await syncCleaner.execute(user);
    }
}