//const data = require('./data.json')
const dbConfig = require('./connections.json')
const ethConfig = require('./config.json')
const Pool = require('pg').Pool
const pool = new Pool(dbConfig.cmsConnection)

const Tx = require('ethereumjs-tx').Transaction

const Web3 = require('web3');
const provider = `https://ropsten.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
const web3 = new Web3( new Web3.providers.HttpProvider(provider) );

const contract = new web3.eth.Contract(ethConfig.ABI, process.env.CONTRACT_ADDRESS)

const placeBet = (request, response)=>{
  let rawBody = JSON.parse(request.rawBody)
  let address = rawBody.address
  let bet = rawBody.bet
  pool.query(
    "INSERT INTO bets (address, bet, status) VALUES($1, $2, $3) RETURNING id",
    [address, bet, 1],
    (error, results) => {
      if (error) {
        throw error
      }
      let id = results.rows[0].id;
      const myData = contract.methods.placeBet(address,bet).encodeABI();
      const privateKey1 = Buffer.from(process.env.PRIVATE_KEY, 'hex');
      const walletAddress = process.env.WALLET;

      web3.eth.getTransactionCount(walletAddress, (err, txCount) => {
        const txObject = {
          nonce:    web3.utils.toHex(txCount),
          to:       process.env.CONTRACT_ADDRESS,
          value:    web3.utils.toHex(web3.utils.toWei('0')),
          gasLimit: web3.utils.toHex(8000000),
          gasPrice: web3.utils.toHex(web3.utils.toWei('60', 'gwei')),
          data: myData
        }
        // Sign the transaction
        const tx = new Tx(txObject, {chain:'ropsten', hardfork: 'petersburg'})
        tx.sign(privateKey1);

        const serializedTx = tx.serialize();
        const raw = '0x' + serializedTx.toString('hex');

        // Broadcast the transaction
        const transaction = web3.eth.sendSignedTransaction(raw, (err, tx) => {
          if(err!=null){
            response.status(500).json(JSON.parse('{"message":"error"}'));
          }
        }).once('transactionHash', (hash)=>{
          response.status(200).json({"transactionHash":hash});
          //pending
          pool.query("UPDATE bets SET txn='"+hash+"', status=2 WHERE id="+id,(error, results)=>{
            if (error) {
              throw error
            }
          });
        })
        .on('confirmation', (confNumber, receipt)=>{
          //complete
          pool.query("UPDATE bets SET status=3 WHERE id="+id,(error, results)=>{
            if (error) {
              throw error
            }
          });
         })
        .on('error', (error)=>{
           response.status(500).json(JSON.parse('{"message":"error"}'));
         })
        .then((receipt)=>{
          //response.status(200).json(JSON.parse('{"message":"ok"}'));
        });
      });
    }
  )
}
const rollDice = (request, response)=>{
  const myData = contract.methods.rollDice().encodeABI();
  const privateKey1 = Buffer.from(process.env.PRIVATE_KEY, 'hex');
  const walletAddress = process.env.WALLET;

  web3.eth.getTransactionCount(walletAddress, (err, txCount) => {
    const txObject = {
      nonce:    web3.utils.toHex(txCount),
      to:       process.env.CONTRACT_ADDRESS,
      value:    web3.utils.toHex(web3.utils.toWei('0')),
      gasLimit: web3.utils.toHex(8000000),
      gasPrice: web3.utils.toHex(web3.utils.toWei('60', 'gwei')),
      data: myData
    }
    // Sign the transaction
    const tx = new Tx(txObject, {chain:'ropsten', hardfork: 'petersburg'})
    tx.sign(privateKey1);

    const serializedTx = tx.serialize();
    const raw = '0x' + serializedTx.toString('hex');

    // Broadcast the transaction
    const transaction = web3.eth.sendSignedTransaction(raw, (err, tx) => {
      if(err!=null){
        response.status(500).json(JSON.parse('{"message":"error"}'));
      }
    }).once('transactionHash', (hash)=>{
      //console.log("transactionHash:"+hash);
      response.status(200).json({"transactionHash":hash});
    })
    .on('error', (error)=>{
       response.status(500).json(JSON.parse('{"message":"error"}'));
     })
    .then((receipt)=>{
      console.log("then:"+receipt);
      //response.status(200).json(JSON.parse('{"message":"ok"}'));
    });
  });
}
const getResult = (request, response)=>{
  contract.methods.getResult().call().then((result)=>{
    console.log("result:"+result);
    pool.query('select * from bets where bet='+result+' and status=3 order by 1', (error, results) => {
      if (error) {
        throw error
      }
      response.status(200).json(results.rows)
    })
  });
}

async function signTx(payload) {
  let { from, to, data, value, gas, gasPrice, privKey, nonce } = payload
  let txParams = {
    to,
    data,
    value: web3.utils.toHex(value),
    gasPrice: web3.utils.toHex(gasPrice),
    gas: web3.utils.toHex(gas),
    nonce: web3.utils.toHex(nonce)
  }
  var tx = new Tx(txParams)
  privKey = await _validatePrivKey(privKey)
  privKey = new Buffer(privKey, 'hex')
  tx.sign(privKey)
  privKey = null
  return tx
}

async function submitSignedTx(serializedTx) {
  return new Promise((fullfill, reject) => {
    web3.eth.sendSignedTransaction(serializedTx)
      .on('transactionHash', txHash => {
        l.info('transaction sent. hash =>', txHash)
        return fullfill({success: true, txHash : txHash})
      })
      .on('error', e => {
        // console.log('unable to send tx', e)
        l.error(logmsg, e.message)
        return fullfill({success: false, message: e})
      })
  })
}

module.exports = {
  placeBet,
  rollDice,
  getResult
}
