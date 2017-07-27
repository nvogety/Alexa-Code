
var APP_ID = "amzn1.ask.skill.XXXXXXXXXXXX"; //replace with "amzn1.echo-sdk-ams.app.[your-unique-value-here]";


var http = require('https');
var AlexaSkill = require('./AlexaSkill');


var DoorCommunication = function () {
    AlexaSkill.call(this, APP_ID);
};


//IOT things
var config = {};

config.IOT_BROKER_ENDPOINT      = "<Your-endpint>".toLowerCase();

config.IOT_BROKER_REGION        = "<Your-region>";

config.IOT_THING_NAME           = "<Your-Thing>";

//Loading AWS SDK libraries

var AWS = require('aws-sdk');

AWS.config.region = config.IOT_BROKER_REGION;

//Initializing client for IoT

var iotData = new AWS.IotData({endpoint: config.IOT_BROKER_ENDPOINT})


//DB setup
var docClient = new AWS.DynamoDB.DocumentClient();
var table = "piMessages";
//var count = 0;



// Extend AlexaSkill
DoorCommunication.prototype = Object.create(AlexaSkill.prototype);
DoorCommunication.prototype.constructor = DoorCommunication;

DoorCommunication.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("DoorCommunication onSessionStarted requestId: " + sessionStartedRequest.requestId + ", sessionId: " + session.sessionId);
};

DoorCommunication.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("DoorCommunication onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    var speechOutput = "Welcome to the DoorCommunication Demo, you can ask me to send a message to the door";
	
    response.ask(speechOutput);
};

DoorCommunication.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("DoorCommunication onSessionEnded requestId: " + sessionEndedRequest.requestId + ", sessionId: " + session.sessionId);
};

DoorCommunication.prototype.intentHandlers = {
    // register custom intent handlers
    MessageIntent: function (intent, session, response) {
        
		var msg = intent.slots.message.value;
		var repromptText = null;
        var sessionAttributes = {};
        var shouldEndSession = true;
        var speechOutput = "";
        var id = Date.now();
        var dbMessage="";
        
        console.log("Id:"+id+"--Message:"+msg);
        
        var payloadObj={ "messageID":id, "message": msg };
    
        //Prepare the parameters of the update call
    
        var paramsUpdate = {
            "topic" : "alexaToPi",
            "payload" : JSON.stringify(payloadObj),
            "qos" : 1
        };
        
        iotData.publish(paramsUpdate, function(err, data) {
    
          if (err){
            //Handle the error here
            console.log(err);
          } else {
    
            speechOutput = "You said "+msg+".";
            //console.log("Dynamo Data is From "+table);
            
            var count = 0;
                params = {
                    TableName : table,
                    Limit: 10
                };
                setTimeout( function() {
                    //console.log("Get message from DynamoDB now, Id:"+id);
                    
                    docClient.scan(params, function(err, data) {
                        //console.log("Inside getting from docClient");
                        if (err) {
                            console.log("Reading dynamodb failed.."+err);
                            // context.done('error','reading dynamodb failed: '+err);
                        } else {
                            console.log("Data from DynamoDB:"+data)
                            count = data.Count;
                            console.log("Number of items in this list "+count);
                            data.Items.forEach( function(row) {                
                                 console.log("Row details: Id:", row.messageID, " -- Message:", row.myMessage);
                                if(row.messageID == id){
                                    dbMessage = row.myMessage;
                                    speechOutput+=" Visitor said "+ row.myMessage;
                                    console.log("SPEECH OUTPUT: "+speechOutput);
                                }
                                
                            }); // for each

                            var delParams = {
                                TableName : table,
                                Key: {
                                    "messageID": id,
                                    "myMessage": dbMessage
                                }
                            };
                            
                            docClient.delete(delParams, 
                                function(err, data) {
                                    if (err) console.log(err);
                                    else console.log("DELETED: "+data);
                                });
                            setTimeout(function(){
                                console.log("Should have deleted.. Tell Alexa")
                                response.tell(speechOutput);  
                            }, 2000); 
                        }
                    });  // scan/get
                }, 15000); // getTimeout
          }    
    
        });
		

    },
    HelpIntent: function (intent, session, response) {
        response.ask("Ask me to send a message!");
    }
};

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the Particle skill.
    var doorComSkill = new DoorCommunication();
    doorComSkill.execute(event, context);
};
