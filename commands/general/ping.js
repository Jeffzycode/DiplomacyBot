const permVerifier = require(`../../QOL/permissionsChecker.js`);

module.exports = {
    name: 'ping',
    description: "ping command",
    requiredPerms: [],
    execute(message, args){
        //Check perms (no need)

        //message.channel.send('From Outside File :)');
        message.channel.send('Pong!');
    }
}