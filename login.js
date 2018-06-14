var express = require('express');
var request = require('request');
const querystring = require('querystring');
var CHANNEL_ACCESS_TOKEN = 'BOpCS2JXlx/6DfqGmLVD9vU8FmjviF0TV/QJoLfkN0C465BHYiKtyfzP1Ov4wEIcF7xFvwu64T/RrO64+cai0dY7Th5yno/goN9+dJVa4EsLoNC5JV4mYF7ROws6Og6vfHByaSO/qQRZR8sy5Bz/twdB04t89/1O/w1cDnyilFU=';
var ANGEL_CHANNEL_ACCESS_TOKEN = 'BOpCS2JXlx/6DfqGmLVD9vU8FmjviF0TV/QJoLfkN0C465BHYiKtyfzP1Ov4wEIcF7xFvwu64T/RrO64+cai0dY7Th5yno/goN9+dJVa4EsLoNC5JV4mYF7ROws6Og6vfHByaSO/qQRZR8sy5Bz/twdB04t89/1O/w1cDnyilFU=';
var MASTER_CHANNEL_ACCESS_TOKEN = 'BOpCS2JXlx/6DfqGmLVD9vU8FmjviF0TV/QJoLfkN0C465BHYiKtyfzP1Ov4wEIcF7xFvwu64T/RrO64+cai0dY7Th5yno/goN9+dJVa4EsLoNC5JV4mYF7ROws6Og6vfHByaSO/qQRZR8sy5Bz/twdB04t89/1O/w1cDnyilFU=';
var HALL_CHANNEL_ACCESS_TOKEN = 'BOpCS2JXlx/6DfqGmLVD9vU8FmjviF0TV/QJoLfkN0C465BHYiKtyfzP1Ov4wEIcF7xFvwu64T/RrO64+cai0dY7Th5yno/goN9+dJVa4EsLoNC5JV4mYF7ROws6Og6vfHByaSO/qQRZR8sy5Bz/twdB04t89/1O/w1cDnyilFU=';
var fs = require('fs');
const { Client } = require('pg');
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    //ssl: true,
    });
var DomParser = require('dom-parser');

const app = express(); //建立一個express 伺服器
app.post('/' , linebotParser); // POST 方法**/
app.post('/hall',linebotParser);
app.post('/angle',anglebot);
app.post('/master',masterbot);
/**
 * expected result:
 *  user:@ok     
 *  bot:googleform
 *  user:done
 * 
 */

//SQL
/**
     angle_nickname |   angle_id    | master_nickname |  master_id   | department | student_id | give_id | head
    ----------------+---------------+-----------------+-----------------------------------------------------------
    友安            | 0123456789012 | 主人             | 123456789012 | 台大物理   |b05202030   | 是       |url
*/  

//login message with recpt function:
function record_angle_id(id){
    psql("INSERT INTO ACCOUNT (angle_id) VALUES (\'"+ id +"\');");    
}
const googleform= {
    "type": "template",
    "altText": "This is a buttons template",
    "template": {
        "type": "buttons",        
        "title": "填寫小主人資料",
        "text": "讓小天使認識你",        
        "actions": [
            {
              "type": "uri",
              "label": "填寫",
              "data": querystring.stringify(psy)
            }
        ]
    }
};
function record_student_id(id,student_id){
    psql("UPDATE ACCOUNT SET student_id=\'"+ student_id +"\' WHERE angle_id=\'" + id +"\';");
}
function passtopsql(id){
        var std_id = psql('SELECT student_id FROM ACCOUNT WHERE angle_id=\''+ id +'\';')[0].student_id;
        var options = {
            url: 'https://docs.google.com/spreadsheets/d/1gqxTKZm7WWQSotmZkn4uWj4vW63dT9Qd53RUMMCl8mc/gviz/tq?tqx=out:html&tq=select%20*%20where%20D%20=%20%27'+std_id+'%27&gid=94689965',
            method: 'GET'    
        }
        var data ={
            angle_nickname:"",
            department:"",
            give_id:"",
            head:""
        }
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
              console.log(body);
              console.log(typeof(body));
              var parser = new DomParser();
              var doc = parser.parseFromString(body, "text/xml");
              console.log(typeof(doc));
              var values = doc.getElementsByTagName("tr")[1].getElementsByTagName("td");
              for (let value of values){
                console.log(value.innerHTML);
              }
              data.head = values[2].innerHTML;
              data.angle_nickname = values[3].innerHTML;
              data.department = values[1].innerHTML;
              data.give_id = values[8].innerHTML;
              console.log(data);
              
              psql("UPDATE ACCOUNT SET head=\'"+ data.head +"\' WHERE angle_id=\'" + id +"\';");
              psql("UPDATE ACCOUNT SET angle_nickname=\'"+ data.angle_nickname +"\' WHERE angle_id=\'" + id +"\';");
              psql("UPDATE ACCOUNT SET department=\'"+ data.department +"\' WHERE angle_id=\'" + id +"\';");
              psql("UPDATE ACCOUNT SET give_id\'"+ data.give_id +"\' WHERE angle_id=\'" + id +"\';");
            }else{
              console.log(error);
              reject("!!!!!error when recpt image!!!!!");                
            }
        });
}

function psql(command){

    var recpt =[];
    client.connect();
    console.log("(psql):" + command );
    client.query(command, (err, res) => {
    if (err) throw err;
    for (let row of res.rows) {
        console.log( "(psql-query):"+ JSON.stringify(row));
        recpt += row;
    }
    client.end();
    });
    return recpt;
}

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
        var posttype = post.events[0].type;
        /**var userMessage = post.events[0].message.text;
        console.log(replyToken);
        console.log(userMessage);**/
        if (typeof replyToken === 'undefined') {
            return;
        }

        if (posttype == 'message'){
            
            if(post.events[0].message.type == 'text'){

                if(post.events[0].message.text == "@ok"){
                    record_angle_id(post.events[0].source.userId);
                    var req = post.events[0].message;
                    req.text ="請輸入你的學號";
                    sendmessage(req);                    
                }
                if(post.events[0].message.text == "@done"){                    
                    passtopsql(post.events[0].source.userId);
                }
                else{ //student id
                    record_student_id( post.events[0].source.userId , post.events[0].message.text);
                    sendmessage(googleform);
                }
            }
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
              })              
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

        function sendmessage(recpt){ //recpt is message object
          var options = {
            url: "https://api.line.me/v2/bot/message/reply ",
            method: 'POST',
            headers: {
              'Content-Type':  'application/json', 
              'Authorization':'Bearer ' + CHANNEL_ACCESS_TOKEN
            },
            json: {
                'replyToken': replyToken,
                'messages': [recpt]
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
          
        }        
    });

}
//因為 express 預設走 port 3000，而 heroku 上預設卻不是，要透過下列程式轉換
var server = app.listen((process.env.PORT || 8080), function() {
    var port = server.address().port;
    console.log("App now running on port", port);
});
//!!!!!