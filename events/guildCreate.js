require('dotenv').config()
const AWS = require('aws-sdk'), CE = require(`../QOL/commonErrors.js`);;

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
    name: 'guildCreate',
    async execute(guild){
        console.log("Joined the server " + guild.name);
        //Create server in the Servers table
        const params = {
            TableName: 'servers',
            Item: {}
        }
        //Provision Basic Info:
        params.Item["id"] = guild.id;
        params.Item["diploChannels"] = {};//Empty Table
        params.Item["treaties"] = {};//Empty Table
        params.Item["countryRoles"] = {};//Empty Table
        //Set the log Channel
        let txtChannels = guild.channels.cache.filter(x => x.type == 0);        
        params.Item["logChannel"] = "NULL";
        if(txtChannels.size !== 0) newLogChannel = txtChannels.at(0).id;//Switch log channel to the topmost log channel it has access to
        //Set the Treaty Output Channel
        params.Item["treatyChannel"] = "NULL";
        if(txtChannels.size !== 0) newLogChannel = txtChannels.at(0).id;//Switch treaty output channel to the topmost log channel it has access to

        try {
            await docClient.put(params).promise();
        } catch (error) {
            await CE.dataCreateError(error);
        }
        console.log("Server profile for " + guild.name + " created successfully");
    }
}