const express = require("express");
const bodyParser = require("body-parser");
const Blockchain = require("./blockchain");
const cryptoRandomString = require('crypto-random-string');

//const uuid = require("uuid");
const rp = require("request-promise");
const nodeAddress = cryptoRandomString({length: 10});

const port  = process.argv[2];

const bitcoin = new Blockchain();

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:false}))

app.get("/hello", (req,res) => {
    res.send("hello")
})

app.get("/blockchain", (req,res) => {
    res.send(bitcoin).status(200);
})

app.post("/transaction", async (req,res) => {
    const newTransaction = req.body;
    const blockIndex = bitcoin.addTransactionToPendingTransaction(newTransaction);
    res.send(`New Transaction will be added to block ${blockIndex}`)
})

app.post("/transaction/broadcast", (req,res) => {
    const newTransaction = bitcoin.createNewTransaction(req.body.amount,req.body.sender,req.body.recipient);
    bitcoin.addTransactionToPendingTransaction(newTransaction);

    const requestPromises= []
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri : networkNodeUrl + '/transaction',
            method : 'POST',
            body : newTransaction,
            json : true
        }
        requestPromises.push(rp(requestOptions));
    });
    Promise.all(requestPromises)
    .then(data => {
        res.send("Transaction created and broadcast successfully");
    });
});

app.get("/mine", (req,res) => {
    const lastBlock = bitcoin.getLastBlock();
    const previousBlockHash = lastBlock["hash"];
    const currentBlockData = {
        transactions: bitcoin.pendingTransactions,
        index: lastBlock['index'] + 1  
    }
    const nounce = bitcoin.proofOfWork(previousBlockHash,currentBlockData);
    const blockHash = bitcoin.hashBlock(previousBlockHash,currentBlockData,nounce);
    const newBlock = bitcoin.createNewBlock(nounce,previousBlockHash,blockHash);

    const requestPromises = [];
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/receive-new-block',
            method: 'POST',
            body: {newBlock: newBlock},
            json: true
        }
        requestPromises.push(rp(requestOptions));
    });
    Promise.all(requestPromises)
    .then(data => {
        const requestOptions = {
            uri: bitcoin.currentNodeUrl + '/transaction/broadcast',
            method: 'POST',
            body: {
                amount: 12.5,
                sender: '00',
                recipient: nodeAddress
            },
            json: true
        };
        return rp(requestOptions);
    })
    .then(data => {
        res.send("New Block mined successfully ",newBlock).status(200)
    })
})

app.post('/receive-new-block', (req,res) => {
    const newBlock = req.body.newBlock;
    const lastBlock = bitcoin.getLastBlock();
    const correctHash = newBlock.previousBlockHash == lastBlock.hash;
    const correctIndex = lastBlock['index'] + 1 == newBlock['index'];

    if(correctHash && correctIndex){
        bitcoin.chain.push(newBlock);
        bitcoin.pendingTransactions = [];
        res.send(`New Block Received and accepted `,newBlock);
    }
    else{
        res.send(`New Block Rejected `,newBlock)
    }
})


//register and broadcast node to network
app.post("/register-and-broadcast-node", (req,res) => {
    const newNodeUrl = req.body.newNodeUrl;
    if (bitcoin.networkNodes.indexOf(newNodeUrl) == -1) bitcoin.networkNodes.push(newNodeUrl);

    const regNodePromises = []
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/register-node',
            method: 'POST',
            body: { newNodeUrl:newNodeUrl },
            json: true
        }
        regNodePromises.push(rp(requestOptions));
    });

    Promise.all(regNodePromises)
    .then(data => {
        const bulkRegisterOptions = {
            uri: newNodeUrl + '/register-nodes-bulk',
            method: 'POST',
            body: { allNetworkNodes: [ ...bitcoin.networkNodes, bitcoin.currentNodeUrl]},
            json: true
        };
        return rp(bulkRegisterOptions)
    })
    .then(data => {
        res.send("New Node Registered Successfully.")
    })
});

//register node with network
app.post("/register-node", (req,res) => {
    const newNodeUrl = req.body.newNodeUrl;
    const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(newNodeUrl) == -1;
    const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;
    if(nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(newNodeUrl);
    res.send("New Node Registered Successfully to network")
});

app.post("/register-nodes-bulk", (req,res) => {
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach(networkNodeUrl => {
        const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(networkNodeUrl) == -1;
        const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl;
        if (nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(networkNodeUrl)
    });
    res.send("Bulk Registration Succesfully")
});


app.listen(port, function(){
    console.log(`Listening to Port ${port}...`)
})