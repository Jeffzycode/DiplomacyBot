require('dotenv').config();
/*
STRING OUTPUT ARRAY
Discord limits one message to 2000 characters. String Output Array will append strings onto the back of the
internal array without surpassing 2000 characters, thus allowing a large output to be printed in as few
messages as possible
*/

module.exports = class stringOutputArray {
    constructor(){
        this.internalArray = [""];//Initialize internal array
        this.ULIMIT = process.env.DISCORD_MAX_MESSAGE_CHARS;
    }
    push(__newString){
        if(this.internalArray[this.internalArray.length-1].length+__newString.length <= this.ULIMIT) this.internalArray[this.internalArray.length-1] += __newString;//Can safely append
        else this.internalArray.push(__newString);//Make a new entry
    }
    pop(){
        return this.internalArray.pop();//Same operation as an array
    }
    async send(outputChannel){
        for(i = 0; i < this.internalArray.length; i++) await outputChannel.send(this.internalArray[i]);//Send over discord
    }
}