const Blockchain = require('./blockchain');
const bitcoin = new Blockchain();

console.log(bitcoin)
/*
const currentBlockData = [
    {
        amount:50,
        sender:'UHUJFTC74938',
        recipient:'YGTYI874YHGBYI'
    }
]
const previousHashBlock = 'GYY7487GYUU'
const nounce = bitcoin.proofOfWork(previousHashBlock,currentBlockData)
console.log(bitcoin.hashBlock(previousHashBlock,currentBlockData,nounce))
*/

