require('dotenv').config();
const assert = require('assert');
const AWS = require('aws-sdk'), updateDB = require(`../../QOL/updateDB.js`), CE = require(`../../QOL/commonErrors.js`), permVerifier = require(`../../QOL/permissionsChecker.js`);
const {PermissionsBitField} = require('discord.js');

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const docClient = new AWS.DynamoDB.DocumentClient();
async function printAllTreaties(outputChannel, lstOfTreaties) {//lstOfTreaties is a list of objects
    lstOfTreaties.sort((a, b) => {(a.id > b.id) ? 1 : -1});//Sort treaties by date
    //TODO: print treaties
    //Convert all the treaties into embeds
    if(lstOfTreaties.length === 0){//No treaties found
        await outputChannel.send("No treaties found :(");
        return;
    }
    let outputEmbeds = [[]];
    for(i = 0; i < lstOfTreaties.length; i++){
        let indivTreaty = lstOfTreaties[i];
        let signatoryString = "";
        for(signatory in indivTreaty.signatories) signatoryString += '<@&' + signatory + '> (' + indivTreaty.signatories[signatory] + '), ';//Make a string with signatories
        //Construct the embed
        let curEmbed = {
            title: indivTreaty.title,
            description: 'ID: ' + indivTreaty.id,
            fields: [
                {
                    name: 'Date signed:',
                    value: (new Date(indivTreaty.date+"T00:00:01")).toLocaleDateString("en-US", {year: 'numeric', month: 'long', day: 'numeric'}),
                    inline: true
                },
                {
                    name: 'Clauses:',
                    value: indivTreaty.clauses.length,
                    inline: true
                },
                {
                    name: 'Signatories:',
                    value: signatoryString,
                    inline: false
                }
            ]
        }
        if(outputEmbeds[outputEmbeds.length-1].length < 10) outputEmbeds[outputEmbeds.length-1].push(curEmbed);//Append to the back of the last array
        else outputEmbeds.push([curEmbed]);//Make new array
    }
    //Send all of the treaties
    await outputChannel.send("Found " + lstOfTreaties.length + " treaties.");
    for(i = 0; i < outputEmbeds.length; i++) await outputChannel.send({embeds: outputEmbeds[i]});

}
async function getAllTreaties(outputChannel, serverID){
    let serverProfile;
    try {//Fetch profile
        serverProfile = await docClient.get({TableName: 'servers', Key: {id: serverID}}).promise();
    } catch (error) {
        await CE.databaseFetchError(error, outputChannel);
    }
    let lstOfTreaties = [];//Treaties
    for(treatyID in serverProfile.Item.treaties){
        lstOfTreaties.push((await docClient.get({TableName: 'treaties', Key: {id: treatyID}}).promise()).Item);//Push items
    }
    await printAllTreaties(outputChannel, lstOfTreaties);
}
async function getSpecificTreaties(outputChannel, guild, args){
    let countryIDs = {}, targetTreatyIDs = {}, lstOfTreaties = [];
    try {//Input validator
        for(i = 0; i < args.length; i++){
            assert(args[i].length > 4);//Eliminate small strings
            let fetchedRole = await guild.roles.fetch(args[i].substring(3, args[i].length-1));
            assert(fetchedRole !== null);//Role must exist
            countryIDs[fetchedRole.id] = true;//Insert
        }
    } catch (error) {
        await outputChannel.send("Invalid command. Use " + process.env.PFIX + "get-treaties @ROLE1 @ROLE2 ...");
        return;
    }
    try {//Try to fetch
        for(countryID in countryIDs){
            let countryProfile = await docClient.get({TableName: 'countryRoles', Key: {id: countryID}}).promise();
            if(countryProfile.Item === undefined){//Not a country role
                await outputChannel.send("You cannot get treaties signed by a non-country.");
                return;
            }
            for(treatyID in countryProfile.Item.treaties) {//Iterate over treaties
                if(targetTreatyIDs.hasOwnProperty(treatyID)) targetTreatyIDs[treatyID]++;//Increment
                else targetTreatyIDs[treatyID] = 1;//Insert
            }
        }
    } catch (error){
        await CE.databaseFetchError(error, outputChannel);
    }
    let numCountries = Object.keys(countryIDs).length;
    for(candidTreatyID in targetTreatyIDs) {
        if(targetTreatyIDs[candidTreatyID] !== numCountries) continue;//Not signed by one of the countries
        try {//Try pushing treaty into the list of treaties we want to consider
            lstOfTreaties.push((await docClient.get({TableName: 'treaties', Key: {id: candidTreatyID}}).promise()).Item);//Push treaty object
        } catch (error) {
            await CE.databaseFetchError(error, outputChannel);
        }
    }
    await printAllTreaties(outputChannel, lstOfTreaties);
}
module.exports = {    
    name: 'get-treaties',
    description: "Gets all treaties, or all treaties signed by all of the provided countries.",
    requiredPerms: [PermissionsBitField.Flags.Administrator],
    async execute(message, args){
        //Perms checker
        if(! (await permVerifier.checkPermissions(message.author, this.requiredPerms, false, message))) return;
        if(args.length === 0){//Get all treaties (restrict this command to admins only)
            await getAllTreaties(message.channel, message.guild.id);
        } else {//Get all treaties signed by ALL of the provided roles
            await getSpecificTreaties(message.channel, message.guild, args);
        }
    }
}