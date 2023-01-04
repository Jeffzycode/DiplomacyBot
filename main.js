const {Client, GatewayIntentBits, Partials, Collection, EmbedBuilder} = require('discord.js');

const fs = require('fs');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,   
        GatewayIntentBits.MessageContent    
    ],
    partials: [
        Partials.Channel
    ]
});

const AWS = require('aws-sdk');

const AsyncQueue = require('@sapphire/async-queue');

const { exit } = require('process');

require('dotenv').config();

//Connect to the AWS Database
AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

//AWS stuff
const dbClient = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

console.log("Connected to the AWS Database")

//TODO- allow server-specific prefixes
const prefix = process.env.PFIX;

//AsyncQueue
const eventQueue = new AsyncQueue.AsyncQueue();

//Fetch command & event files
client.commands = new Collection();
client.events = new Collection();
client.DMCommands = new Collection();
const commandFiles = fs.readdirSync('./commands/'), eventFiles = fs.readdirSync('./events/').filter(file => file.endsWith('.js')), DMCommandFiles = fs.readdirSync('./DMCommands/').filter(file => file.endsWith('.js'));
for(const file of commandFiles) {
    if(file === '.gitignore') continue;//Skip the gitignore file
    if(file === 'experimental') continue;//Do not allow experimental commands
    const subFiles = fs.readdirSync(`./commands/${file}/`).filter(file => file.endsWith('.js'));
    for(const subFile of subFiles) {
        const command = require(`./commands/${file}/${subFile}`);
        client.commands.set(command.name, command);
    }
}
for(const file of eventFiles){
    const evnt = require(`./events/${file}`);
    client.events.set(evnt.name, evnt);
}
for(const file of DMCommandFiles) {
    const command = require(`./DMCommands/${file}`);
    client.DMCommands.set(command.name, command);
}

client.once('ready', () => {
    console.log('TestBot Is Online');
    console.log("prefix is " + prefix);
});

/*
client.on('interactionCreate', interaction =>{
    console.log('Got an interaction');
});*/

client.on('guildCreate', async guild => {
    try {//Push to event queue
        await eventQueue.wait();
        try {
            await client.events.get('guildCreate').execute(guild);
        } finally {
            eventQueue.shift();
        } 
    } catch(error) {
        console.log("Critial error, " + error);
    }
})

client.on('channelDelete', async guildChannel => {
    try {
        await eventQueue.wait();
        try {
            await client.events.get('channelDelete').execute(guildChannel);
        } finally {
            eventQueue.shift();
        }
    } catch(error) {
        console.log("Critial error, " + error);
    }
})

client.on('roleDelete', async role => {
    try {
        await eventQueue.wait();
        try {
            await client.events.get('roleDelete').execute(role);
        } finally {
            eventQueue.shift();
        }
    } catch(error) {
        console.log("Critial error, " + error);
    }
})

client.on('guildDelete', async guild => {
    try {
        await eventQueue.wait();
        try {
            await client.events.get('guildDelete').execute(guild);
        } finally {
            eventQueue.shift();
        }
    } catch(error) {
        console.log("Critial error, " + error);
    }
})

client.on("messageCreate", async message => {
    
    if(! message.content.startsWith(prefix) || message.author.bot) return;
    const args = message.content.replace(/(\r\n|\n|\r)/gm, "").slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();
    //console.log(args + '\n' + command);
    //await message.guild.members.fetch();//Force cache members
    if(message.channel.type === 1) {//DM command
        if(! client.DMCommands.has(command)) return;//Non-existent command
        if(client.DMCommands.get(command).hasOwnProperty('needsServerList')) {
            await eventQueue.wait();
            try {
                await client.DMCommands.get(command).execute(await client.guilds.fetch(), message.author);//Supplies server list
            } finally {
                eventQueue.shift();
            }

        } else {
            await eventQueue.wait();
            try {
                await client.DMCommands.get(command).execute(message.author);
            } finally {
                eventQueue.shift();
            }
        }
        return;//Goodbye
    }
    try {//Attempt to find command
        if(client.commands.has(command)) {
            //Run the command
            await eventQueue.wait();
            try {
                await client.commands.get(command).execute(message, args);
            } finally {
                eventQueue.shift();
            } 
        } else {
            message.channel.send('Command does not exist.');
        }
    } catch(error) {
        try {
            message.channel.send("Critical Error, contact Developers immediately.");
        } catch {

        }
        console.log("Critial error, " + error);
    }
})

client.login(process.env.DISCORD_TOKEN);