require('dotenv').config()
const AWS = require('aws-sdk');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

//Module to update a characteristic in DynamoDB

module.exports = {
    async updateTable (nameOfTable, itemKey, attrib, newCharacteristic){
        /**
        nameOfTable: Name of the Table to write to (EG: servers, diploChannels, etc.)
        itemKey: Key of the Item being updated
        attrib: Header of the characteristic being updated (EG: members, curTreaty, etc.)
        newCharacteristic: characteristic that is being updated
        **/
        const updateParams = {//Makes table with characteristic
            TableName: nameOfTable,
            Key: {
                id: itemKey
            },
            UpdateExpression: "set #itemAttrib = :newItem",
            ExpressionAttributeNames: {
                "#itemAttrib": attrib
            },
            ExpressionAttributeValues: {
                ":newItem": newCharacteristic
            }
        }
        await docClient.update(updateParams).promise();//Push changes
    },
    async deleteAttribute(nameOfTable, itemKey, attrib) {
        /**
        nameOfTable: Name of the Table to write to (EG: servers, diploChannels, etc.)
        itemKey: Key of the Item being deleted
        attrib: Header of the characteristic being deleted (EG: members, curTreaty, etc.)
        **/
        const updateParams = {
            TableName: nameOfTable,
            Key: {
                id: itemKey
            },
            UpdateExpression: "remove #itemAttrib",
            ExpressionAttributeNames: {
                "#itemAttrib": attrib
            }       
        }
        await docClient.update(updateParams).promise();
    }
}