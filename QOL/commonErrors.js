/*
Common responses to error messages
*/
module.exports = {
    async databaseFetchError(error, outputChannel = undefined){
        if(outputChannel !== undefined) await outputChannel.send("Error when fetching from database, contact a developer.");
        console.log("Error when fetching from database, " + error);
        throw "Error when fetching from database, " + error;
    },
    async databasePushError(error, outputChannel = undefined) {
        if(outputChannel !== undefined) await outputChannel.send("Error when pushing to database, contact a developer.");
        console.log("Error when pushing to database, " + error);
        throw "Error when pushing to database, " + error;
    },
    async dataDeleteError(error, outputChannel = undefined) {
        if(outputChannel !== undefined) await outputChannel.send("Error when deleting from database, contact a developer.");
        console.log("Error when deleting from database, " + error);
        throw "Error when deleting from database, " + error;
    },
    async dataCreateError(error, outputChannel = undefined){
        if(outputChannel !== undefined) await outputChannel.send("Error when creating entry in database, contact a developer.");
        console.log("Error when creating entry in database, " + error);
        throw "Error when creating entry in database, " + error;
    }
}