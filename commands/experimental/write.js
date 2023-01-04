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
    name: 'write',
    description: "test writing to AWS",
    execute(message, args){
        let profile = {}
        let filter = (msg) => !msg.author.bot
        let options = {
            max: 1,
            time: 15000
        }
        console.log(process.env.AWS_DEFAULT_REGION)
        console.log(process.env.AWS_ACCESS_KEY_ID)
        console.log(process.env.AWS_SECRET_ACCESS_KEY)

        message.member.send("What is the name of the warship?").then(dm => {
            console.log(`Sent Message: ${dm.content}`)
            return dm.channel.awaitMessages({filter, max: 1, time: 15000})
        }).then(collector => {
            profile.shipName = collector.at(0).content;
            return message.member.send("What is the class of the warship?")
        }).then(dm => {
            return dm.channel.awaitMessages({filter, max: 1, time: 15000})
        }).then(collector => {
            profile.shipClass = collector.at(0).content
            return message.member.send("What year was it built?")
        }).then(dm => {
            return dm.channel.awaitMessages({filter, max: 1, time: 15000})
        }).then(collector => {
            profile.yearBuilt = collector.at(0).content
            console.log(profile)
            const params = {
                TableName: 'testTable',
                Item: {
                    1: Math.floor(Math.random()*1000000),//Delete this when properly making the table
                }
            }
            for (const __attr in profile)  {
                console.log(__attr)
                params.Item[__attr] = profile[__attr]
            }
            console.log(params)
            console.log(Math.floor(Math.random()*1000000))
            docClient.put(params, (error) => {
                if(! error) return message.member.send("Confirmed Entry")
                else throw "Unable to save profile, " + error
            })
        })
        
        // msgContent = oriMessage.channel.awaitMessages(filter, options)
        // profile.shipName = msgContent.array()[0].content
        // console.log(profile)
    }
}