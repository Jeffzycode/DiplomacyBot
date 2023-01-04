require('dotenv').config()
const AWS = require('aws-sdk');
const { MessageFlags } = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
    name: 'read',
    description: "test reading from DynamoDB. Only reads by ship name for now",
    execute(message, args){
        const argLine = args.join(' ');
        var params = {
            ExpressionAttributeValues: {
                ":sname" : argLine
            },
            TableName: 'testTable',
            FilterExpression: 'shipName = :sname',
        }
        console.log(params)
        docClient.scan(params, function(err, data) {
            if(err) console.log(err)
            else {
                message.channel.send("Listing all Warships named " + argLine + ":\n")
                console.log(data.Items) 
                for (__item of data.Items) {
                    __msg = "";
                    for(const __attr in __item)  {
                        __msg = __msg.concat(__attr+": "+__item[__attr] + "\n")
                        console.log(__attr)
                    }
                    console.log(__msg.length)
                    message.channel.send(__msg + "\n")
                }
            }
        });
        // msgContent = oriMessage.channel.awaitMessages(filter, options)
        // profile.shipName = msgContent.array()[0].content
        // console.log(profile)
    }
}