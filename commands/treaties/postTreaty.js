require('dotenv').config();
const assert = require('assert');
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`), stringOutputArray = require(`../../QOL/stringOutputArray.js`), CE = require(`../../QOL/commonErrors.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);
const {PermissionsBitField} = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();

async function refreshSignatories(channelProfile){
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

async function updateCountryProfile(roleID, treatyID){
    //Adds the treaty to the country profile
    let countryProfile;
    try {//Fetch profile
        countryProfile = await docClient.get({TableName: 'countryRoles', Key: {id: roleID}}).promise();
    } catch (error){
        await CE.databaseFetchError(error);
        return;
    }
    countryProfile.Item.treaties[treatyID] = true;//Add attribute
    try {
        await updateDB.updateTable('countryRoles', roleID, 'treaties', countryProfile.Item.treaties);//Push changes to database
    } catch (error) {
        await CE.databasePushError(error);
    }
}

async function updateServerProfile(serverID, treatyID){
    let serverProfile;
    try {
        serverProfile = await docClient.get({TableName: 'servers', Key: {id: serverID}}).promise();
    } catch (error){
        await CE.databaseFetchError(error);
    }
    serverProfile.Item.treaties[treatyID] = true;
    try {
        await updateDB.updateTable('servers', serverID, 'treaties', serverProfile.Item.treaties);//Push changes to database
    } catch (error) {
        await CE.databasePushError(error);
    }
}

async function logTreaty(serverID, treatyObj, roleManager){
    //Logs the treaty to the treaties databases, constructing connections as necessary
    //Get unique ID:
    let treatyID = String(Math.floor((new Date().valueOf()))*1000+Math.floor(1000*Math.random()));//Gets current time and combines it with a random number (very low chance of colliding)
    //Construct entry for treaties database
    const params = {
        TableName: 'treaties',
        Item: {
            id: treatyID,
            title: treatyObj.title,
            date: treatyObj.date,
            server: serverID,
            signatories: {},
            clauses: treatyObj.clauses
        }
    }
    for(signatory in treatyObj.signatories){
        await updateCountryProfile(signatory, treatyID);//Update country profiles
        let roleName = (await roleManager.fetch(signatory)).name;
        params.Item.signatories[signatory] = roleName; 
    }
    //Update server profile
    await updateServerProfile(serverID, treatyID);
    //Push entry to treaties DB
    await docClient.put(params).promise();
    return treatyID;
}

async function sendTreaty(treatyObj, serverID, message, treatyID){
    let serverProfile;
    try {
        serverProfile = await docClient.get({TableName: 'servers', Key: {id: serverID}}).promise();
    } catch (error) {
        await CE.databaseFetchError(error, message.channel);
    }
    if(serverProfile.Item.treatyChannel === "NULL") {//No point in outputting, there is no designated output channel
        await message.channel.send("There is currently no treaty output channel. Set one using " + process.env.PFIX + "set-treaty-channel.");
        return;
    }
    let treatyOutputChannel = await message.guild.channels.fetch(serverProfile.Item.treatyChannel);
    //Output stuff
    //Make this embed? Nope
    let outputStrings = new stringOutputArray();
    //Assign variables
    //TITLE and ID
    outputStrings.push("> **" + treatyObj.title + "** (ID: " + treatyID + ")\n");
    //DATE
    outputStrings.push("> " + new Date(treatyObj.date+"T00:00:01").toLocaleDateString("en-US", {year: 'numeric', month: 'long', day: 'numeric'}) + "\n> ** **\n");
    //CLAUSES
    for(i = 0; i < treatyObj.clauses.length; i++) outputStrings.push("> __Article" + String(i+1) + ".__ " + treatyObj.clauses[i] + "\n> ** **\n");
    //SIGNATORIES
    outputStrings.push("> Signed: ");
    for(signatory in treatyObj.signatories) outputStrings.push('<@&' + signatory + '> ');
    //Send message
    await outputStrings.send(treatyOutputChannel);
    //Old plaintext format
    
    /*
    let treatyTitle, treatyDate, treatyClauses = [], treatySignatories = [];
    treatyTitle = treatyObj.title;
    treatyDate = new Date(treatyObj.date+"T00:00:01").toLocaleDateString("en-US", {year: 'numeric', month: 'long', day: 'numeric'});
    
    for(i = 0; i < treatyObj.clauses.length; i++) treatyClauses.push(treatyObj.clauses[i]);
    for(signatory in treatyObj.signatories) treatySignatories.push(signatory);

    //Convert raw output to output strings
    await treatyOutputChannel.send("**" + treatyTitle + "** (ID: " + treatyID + ")\n*" + treatyDate + "*");
    for(i = 0; i < treatyClauses.length; i++) await treatyOutputChannel.send(" > __Article " + String(i+1) + ".__ " + treatyClauses[i]);
    let signatoryMessage = "Signed: ";//Send signatories
    for(i = 0; i < treatySignatories.length; i++) signatoryMessage += ('<@&' + treatySignatories[i] + '>');
    await treatyOutputChannel.send(signatoryMessage);*/
}
async function checkNumTreaties(serverID){//Check if the number of treaties in the server is below the threshhold
    let serverProfile;
    try {
        serverProfile = await docClient.get({TableName: 'servers', Key: {id: serverID}}).promise();
    } catch (error) {
        await CE.databaseFetchError(error);
        return;
    }
    return (! (Object.keys(serverProfile.Item.treaties).length >= process.env.MAX_TOTAL_TREATIES));
}

module.exports = {    
    name: 'post-treaty',
    description: "Posts the treaty in the treaties output channel and logs the treaty.",
    requiredPerms: [PermissionsBitField.Flags.Administrator],
    async execute(message, args){
        //Perms checker
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        //Step 1. Background checks (check that the command is sent in a diplo channel, the treaty exists, etc.)
        let channelProfile;
        try {//Fetch channel profile
            channelProfile = await docClient.get({TableName: 'diploChannels', Key: {id: message.channel.id}}).promise();
        } catch (error) {
            await CE.databaseFetchError(error, message.channel);
            return;
        }
        if(channelProfile.Item === undefined) {//Not a diplo channel
            await message.channel.send("You cannot post a treaty from a non-diplo channel.");
            return;
        }
        if(Object.keys(channelProfile.Item.curTreaty).length === 0) {//There is no treaty in the channel
            await message.channel.send("You cannot post a non-existent treaty. To make a new treaty, use " + process.env.PFIX + "make-treaty.");
            return;
        }
        //Check that we can post the treaty without going above the max number of treaties per server
        if(! await checkNumTreaties(channelProfile.Item.server)) {
            await message.channel.send("Each server can have a maximum of " + process.env.MAX_TOTAL_TREATIES + " treaties. Void defunct treaties using " + process.env.PFIX + "void-treaty to free up space.");
            return;
        }
        console.log(process.env.MAX_TOTAL_TREATIES);
        //Step 1. Refresh signatories
        await refreshSignatories(channelProfile);
        //Step 2. Check that the treaty has everything needed
        let postedTreaty = channelProfile.Item.curTreaty;
        if(postedTreaty.title.length === 0){//No title
            await message.channel.send("The treaty has no title. Use " + process.env.PFIX + "set-title to set a title.");
            return;
        }
        if(postedTreaty.date.length === 0){//No date
            await message.channel.send("The treaty has no date. Use " + process.env.PFIX + "set-date YYYY-MM-DD to set a date.");
            return;
        }
        if(postedTreaty.clauses.length === 0) {//No clauses
            await message.channel.send("The treaty has no clauses. Use " + process.env.PFIX + "add-clause to add a clause.");
            return;
        }
        if(Object.keys(postedTreaty.signatories).length === 0){//No signatories
            await message.channel.send("The treaty has no signatories. Use " + process.env.PFIX + "sign-treaty to sign the treaty, or " + process.env.PFIX + "add-signatory to force-add a signatory.");
            return;
        }
        //Step 3. Send the treaty
        let treatyID = await logTreaty(message.guild.id, channelProfile.Item.curTreaty, message.guild.roles);
        console.log("Treaty logged");
        await sendTreaty(channelProfile.Item.curTreaty, message.guild.id, message, treatyID);
        //Remove the treaty from the channel
        channelProfile.Item.curTreaty = {};
        try{
            await updateDB.updateTable('diploChannels', message.channel.id, 'curTreaty', channelProfile.Item.curTreaty);
        } catch (error) {
            await CE.databasePushError(error, message.channel);
        }
        console.log("Treaty posted successfully");
        await message.channel.send("Treaty posted successfully.");
    }
}