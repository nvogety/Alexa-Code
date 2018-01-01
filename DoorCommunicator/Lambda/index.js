
/**
 * App ID for the skill
 */
var APP_ID = "amzn1.ask.skill.[unique-skillid-value-here]"; //replace with "amzn1.echo-sdk-ams.app.[your-unique-value-here]";

/**
 * The AlexaSkill prototype and helper functions
 */

var http = require('https');
var AlexaSkill = require('./AlexaSkill');


var DoorCommunication = function () {
    AlexaSkill.call(this, APP_ID);
};

//IOT things
var config = {};

config.IOT_BROKER_ENDPOINT      = "[endpoit-id-here]].iot.us-east-1.amazonaws.com".toLowerCase();

config.IOT_BROKER_REGION        = "us-east-1";

config.IOT_THING_NAME           = "virtualDoorman";

//Loading AWS SDK libraries

var AWS = require('aws-sdk');

AWS.config.region = config.IOT_BROKER_REGION;

//Initializing client for AWS IoT

var iotData = new AWS.IotData({endpoint: config.IOT_BROKER_ENDPOINT})


//DataBase setup
var docClient = new AWS.DynamoDB.DocumentClient();
var table = "piMessages";




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

                var count = 0;
                var params = {
                    TableName : table,
                    Limit: 10
                };
                setTimeout( function() {

                    docClient.scan(params, function(err, data) {

                        if (err) {
                            console.log("Reading dynamodb failed.."+err);
                        } else {
                            count = data.Count;
                            data.Items.forEach( function(row) {
                                if(row.messageID == id){
                                    dbMessage = row.myMessage;
                                    speechOutput+=" Visitor said "+ row.myMessage;
                                }

                            }); // for each

                            var delParams = {
                                TableName : table,
                                Key: {
                                    "messageID": id,
                                    "myMessage": dbMessage
                                }
                            };

                            docClient.delete(delParams, function(err, data) {
                                if (err) console.log(err);
                            });
                            setTimeout(function(){
                                // Relay the msg back to Alexa
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
    // Create an instance of the DoorCommuncation skill.
    var doorComSkill = new DoorCommunication();
    doorComSkill.execute(event, context);
};
