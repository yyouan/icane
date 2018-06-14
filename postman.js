var express = require('express');
var querystring = require('querystring');
var request = require('request');
var CHANNEL_ACCESS_TOKEN = 'BOpCS2JXlx/6DfqGmLVD9vU8FmjviF0TV/QJoLfkN0C465BHYiKtyfzP1Ov4wEIcF7xFvwu64T/RrO64+cai0dY7Th5yno/goN9+dJVa4EsLoNC5JV4mYF7ROws6Og6vfHByaSO/qQRZR8sy5Bz/twdB04t89/1O/w1cDnyilFU=';
var ANGEL_CHANNEL_ACCESS_TOKEN = 'BOpCS2JXlx/6DfqGmLVD9vU8FmjviF0TV/QJoLfkN0C465BHYiKtyfzP1Ov4wEIcF7xFvwu64T/RrO64+cai0dY7Th5yno/goN9+dJVa4EsLoNC5JV4mYF7ROws6Og6vfHByaSO/qQRZR8sy5Bz/twdB04t89/1O/w1cDnyilFU=';
var MASTER_CHANNEL_ACCESS_TOKEN = 'BOpCS2JXlx/6DfqGmLVD9vU8FmjviF0TV/QJoLfkN0C465BHYiKtyfzP1Ov4wEIcF7xFvwu64T/RrO64+cai0dY7Th5yno/goN9+dJVa4EsLoNC5JV4mYF7ROws6Og6vfHByaSO/qQRZR8sy5Bz/twdB04t89/1O/w1cDnyilFU=';
var HALL_CHANNEL_ACCESS_TOKEN = 'BOpCS2JXlx/6DfqGmLVD9vU8FmjviF0TV/QJoLfkN0C465BHYiKtyfzP1Ov4wEIcF7xFvwu64T/RrO64+cai0dY7Th5yno/goN9+dJVa4EsLoNC5JV4mYF7ROws6Og6vfHByaSO/qQRZR8sy5Bz/twdB04t89/1O/w1cDnyilFU=';
var FormData = require('form-data');
var fs = require('fs');

const app = express(); //建立一個express 伺服器
app.post('/' , linebotParser); // POST 方法**/
app.post('/angle',anglebot);
app.post('/master',masterbot);
app.post('/hall',hallbot);
app.get('/monitor',monitorhtml);
app.get('/mailflush',mailflush);
app.post('/id',monitormail); //give line push
app.get('/give_id',giving_id_bot); //if call this bot will push line_id
/**const message = {
  type: 'text',
  text: 'Hello World!'
};

client.replyMessage('<replyToken>', message)
  .then(() => {
    ...
  })
  .catch((err) => {
    // error handling
  });**/

//event will like:
/**
 * 
{ type: 'message',
  replyToken: 'xxxxxxx',
  source: 
    { userId: 'xxxxxxx',
      type: 'user',
      profile: [Function] },
  timestamp: 1484472609833,
  message: 
    { type: 'text',
      id: 'xxxxxxxxxx',
      text: 'hihi',
      content: [Function] },
  reply: [Function] }
}
 */

//------------build TCP/IP-------------
function linebotParser(req ,res){
    //route
    var nwimg;
    const domain="https://angleline.herokuapp.com";  
    var adrr="/";
    
    // 定义了一个post变量，用于暂存请求体的信息
    var post = '';     
    // 通过req的data事件监听函数，每当接受到请求体的数据，就累加到post变量中
    req.on('data', function(chunk){   
        post += chunk;
    });
 
    // 在end事件触发后，通过querystring.parse将post解析为真正的POST请求格式，然后向客户端返回。
    req.on('end', function(){    
        post = JSON.parse(post);
        console.log(post.events[0]);
        var replyToken = post.events[0].replyToken;
        /**var userMessage = post.events[0].message.text;
        console.log(replyToken);
        console.log(userMessage);**/
        if (typeof replyToken === 'undefined') {
            return;
        }
        //var imgurl="https://angleline.herokuapp.com/img.jpg";
        if(post.events[0].message.type == 'image'){
            //set adrr
            adrr+=String(post.events[0].message.id);
            adrr+=".jpg";
            console.log(adrr);
            // Configure the request
            var getimage=new Promise((resolve,reject)=>{
              var options = {
                url: 'https://api.line.me/v2/bot/message/'+ post.events[0].message.id +'/content',
                method: 'GET',
                headers: {                
                  'Authorization':'Bearer ' + CHANNEL_ACCESS_TOKEN                  
                },
                encoding: null
              }
  
              // Start the request

              request(options, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                  nwimg = body;
                  console.log(body);
                  resolve(body);                  
                }else{
                  //console.log();
                  reject("!!!!!error when recpt image!!!!!");                
                }
              });              
            });
            
            getimage            
            .then((body)=>{
              //fs.writeFile(__dirname+"/img.jpg","");
              /**fs.writeFile(__dirname+"/img.jpg",body,(err)=>{
                if(err){
                  console.log("(writefile)"+err);
                }else{                  
                  console.log("the file was saved");
                  //console.log(body);
                }
              });**/              
              return Promise.resolve(body); 
            })
            .then(sendmessage)
            .catch((err)=>{
              console.log("(linebotpromise)"+err.message);
            }
            );          
        }else{
          sendmessage(nwimg);
        }

        function sendmessage(recpt){
          var options = {
            url: "https://api.line.me/v2/bot/message/reply ",
            method: 'POST',
            headers: {
              'Content-Type':  'application/json', 
              'Authorization':'Bearer ' + CHANNEL_ACCESS_TOKEN
            },
            json: {
                'replyToken': replyToken,
                'messages': [post.events[0].message]
            }
          };
          if(post.events[0].message.type == 'image'){
                options.json.messages[0].originalContentUrl=(domain+adrr);
                options.json.messages[0].previewImageUrl=(domain+adrr);
                app.get(adrr,(req,res)=>{
                  //res.sendFile(__dirname+"/img.jpg");    
                  res.writeHead(200, {'Content-Type': 'image/jpeg' });
                  res.end(nwimg, 'binary');
                });
          }  
          request(options, function (error, response, body) {
              if (error) throw error;
              console.log("(line)");
              console.log(body);
          });
          //create server
          
        }        
    });

}



//因為 express 預設走 port 3000，而 heroku 上預設卻不是，要透過下列程式轉換
var server = app.listen((process.env.PORT || 8080), function() {
    var port = server.address().port;
    console.log("App now running on port", port);
});
//!!!240




