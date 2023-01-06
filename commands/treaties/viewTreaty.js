require('dotenv').config();
const assert = require('assert');
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`), stringOutputArray = require(`../../QOL/stringOutputArray.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);
const { PermissionsBitField } = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

async function validateSignatories(channelProfile){
    let deletedItem = false;//Nothing was deleted, yet.
    for(signatory in channelProfile.Item.curTreaty.signatories) {
        if(! channelProfile.Item.members.hasOwnProperty(signatory)) {
            delete channelProfile.Item.curTreaty.signatories[signatory];//Delete entry
            deletedItem = true;
        }
    }
    if(! deletedItem) return;//Don't need to waste energy pushing to database
    try {//Attempt to push to database
        await updateDB.updateTable('diploChannels', message.channel.id, 'curTreaty', channelProfile.Item.curTreaty);
    } catch (error) {
        await CE.databasePushError(error);
    }
}

async function postTreatyFromChannel(message){
    let channelProfile;
    try {//Fetch channel profile
        channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: message.channel.id}}).promise();
    } catch (error) {
        await CE.databaseFetchError(error, message.channel);
        return;
    }
    if(channelProfile.Item === undefined) {//Not a diplo channel
        await message.channel.send("You cannot view the treaty of a non-diplo channel."), CE = require(`../../QOL/commonErrors.js`);
        return;
    }
    if(Object.keys(channelProfile.Item.curTreaty).length === 0) {//There is no treaty in the channel
        await message.channel.send("You view a non-existent treaty. To make a new treaty, use " + process.env.PFIX + "make-treaty.");
        return;
    }
    //Refresh signatories
    await validateSignatories(channelProfile);
    //TODO: Make this more aesthetic (use embeds)

    let outputStrings = new stringOutputArray();
    //TITLE
    if(channelProfile.Item.curTreaty.title.length !== 0) outputStrings.push("> **"+channelProfile.Item.curTreaty.title+"**\n");
    else outputStrings.push("> **No title.**");
    //DATE
    if(channelProfile.Item.curTreaty.date.length !== 0) outputStrings.push("> *"+new Date(channelProfile.Item.curTreaty.date+"T00:00:01").toLocaleDateString("en-US", {year: 'numeric', month: 'long', day: 'numeric'}) + "*\n> ** **\n");
    else outputStrings.push("> *No date provided.*\n> ** **\n");
    //CLAUSES
    if(channelProfile.Item.curTreaty.clauses.length === 0){
        outputStrings.push("> *There are currently no clauses. Use " + process.env.PFIX + "add-clause to add a clause.*\n> ** **\n")
    } else {
        for(i = 0; i < channelProfile.Item.curTreaty.clauses.length; i++) outputStrings.push(" > __Article " + String(i+1) + ".__ " + channelProfile.Item.curTreaty.clauses[i] + "\n> ** **\n");
    }
    //SIGNATORIES
    if(Object.keys(channelProfile.Item.curTreaty.signatories).length === 0){//Send signatories
        outputStrings.push("> *Nobody has signed the treaty yet. Use " + process.env.PFIX + "sign-treaty to sign the treaty.*");
    } else {
        let signatoryMessage = "> *Signed:* ";
        for(signatory in channelProfile.Item.curTreaty.signatories) signatoryMessage += ('<@&' + signatory + '>');
        outputStrings.push(signatoryMessage);
    }
    //OUTPUT
    await outputStrings.send(message.channel);

    //OLD OUTPUT
    /*
    let treatyTitle, treatyDate, treatyClauses = [], treatySignatories = [];
    //Assign variables
    if(channelProfile.Item.curTreaty.title.length !== 0) treatyTitle = channelProfile.Item.curTreaty.title;
    else treatyTitle = "No title.";
    if(channelProfile.Item.curTreaty.date.length !== 0) treatyDate = channelProfile.Item.curTreaty.date;
    else treatyDate = "No date provided.";
    
    for(i = 0; i < channelProfile.Item.curTreaty.clauses.length; i++) treatyClauses.push(channelProfile.Item.curTreaty.clauses[i]);
    for(signatory in channelProfile.Item.curTreaty.signatories) treatySignatories.push(signatory);

    await message.channel.send("**" + treatyTitle + "**\n*" + treatyDate + "*");
    if(treatyClauses.length === 0){//Post clauses
        await message.channel.send("*There are currently no clauses. Use " + process.env.PFIX + "add-clause to add a clause.*");
    } else {
        for(i = 0; i < treatyClauses.length; i++) await message.channel.send(" > __Article " + String(i+1) + ".__ " + treatyClauses[i]);
    }
    if(treatySignatories.length === 0){//Send signatories
        await message.channel.send("*Nobody has signed the treaty yet. Use " + process.env.PFIX + "sign-treaty to sign the treaty.*");
    } else {
        let signatoryMessage = "Signed: ";
        for(i = 0; i < treatySignatories.length; i++) signatoryMessage += ('<@&' + treatySignatories[i] + '>');
        await message.channel.send(signatoryMessage);
    }*/
}
async function postSpecificTreaty(treatyObj, treatyOutputChannel){
    let outputStrings = new stringOutputArray();
    //TITLE
    outputStrings.push("> **"+treatyObj.title+"**\n");
    //DATE
    outputStrings.push("> *"+new Date(treatyObj.date+"T00:00:01").toLocaleDateString("en-US", {year: 'numeric', month: 'long', day: 'numeric'}) + "*\n> ** **\n");
    //CLAUSES
    for(i = 0; i < treatyObj.clauses.length; i++) outputStrings.push(" > __Article " + String(i+1) + ".__ " + treatyObj.clauses[i] + "\n> ** **\n");
    //SIGNATORIES
    let signatoryMessage = "> *Signed:* ";
    for(signatory in treatyObj.signatories) signatoryMessage += ('<@&' + signatory + '>');
    outputStrings.push(signatoryMessage);

    //OUTPUT
    await outputStrings.send(treatyOutputChannel);
    //OLD OUTPUT
    /*
    let treatyTitle, treatyDate, treatyClauses = [], treatySignatories = [], treatyID = treatyObj.id;
    
    
    //Assign variables
    treatyTitle = treatyObj.title;
    treatyDate = new Date(treatyObj.date+"T00:00:01").toLocaleDateString("en-US", {year: 'numeric', month: 'long', day: 'numeric'});
    
    for(i = 0; i < treatyObj.clauses.length; i++) treatyClauses.push(treatyObj.clauses[i]);
    for(signatory in treatyObj.signatories) treatySignatories.push([signatory, treatyObj.signatories[signatory]]);

    await treatyOutputChannel.send("**" + treatyTitle + "** (ID: " + treatyID + ")\n*" + treatyDate + "*");
    for(i = 0; i < treatyClauses.length; i++) await treatyOutputChannel.send(" > __Article " + String(i+1) + ".__ " + treatyClauses[i]);
    let signatoryMessage = "Signed: ";//Send signatories
    for(i = 0; i < treatySignatories.length; i++) signatoryMessage += ('<@&' + treatySignatories[i][0] + '> (' + treatySignatories[i][1] + '),');
    await treatyOutputChannel.send(signatoryMessage);*/
}

module.exports = {    
    name: 'view-treaty',
    description: "Views the treaty in the channel, or views the treaty of the provided ID.",
    requiredPerms: [],
    async execute(message, args){
        //Perms checker (useless ATM)
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        if(args.length === 0) await postTreatyFromChannel(message);
        else {
            //Verify that the treaty provided corresponds to a valid treaty.
            let treatyProfile;
            try {
                treatyProfile = await docClient.get({TableName: 'treaties', Key: {id: args[0]}}).promise();
            } catch (error){
                await CE.databaseFetchError(error, message.channel);
            }
            if(treatyProfile.Item === undefined) {//Treaty not found
                await message.channel.send("Treaty not found.");
                return;
            }
            await postSpecificTreaty(treatyProfile.Item, message.channel);
        }
    }
}