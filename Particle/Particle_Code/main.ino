#include "DHT.h"

#define DHTPIN          D3
#define DHTTYPE         DHT22
#define SENSORPIN       D2

DHT dht(DHTPIN, DHTTYPE);
int temperature = 0;
int humidity = 0;

int led1 = D1;
int led2 = D5;


// Returns temperature
int getTemperature(String args){
    return temperature;
}

// Returns humidity
int getHumidity(String args){
    return humidity;
}

int controlled(String args){
    int pos = args.indexOf(',');

    if(-1 == pos){
        return -1;
    }

    String strPin = args.substring(0, pos);
    String strValue = args.substring(pos + 1);

    Serial.println();
    Serial.print("Pin: ");
    Serial.print(strPin);
    Serial.print(" ");
    Serial.print("Value: ");
    Serial.print(strValue);
    Serial.println();

    int pin = D1;
    int value = HIGH;

    if(strPin.equalsIgnoreCase("D1")){
        pin = D1;
    }
    else if(strPin.equalsIgnoreCase("D5")){
        pin = D5;
    }
    else{
        return -2;
    }

    if(strValue.equalsIgnoreCase("HIGH")){
        value = HIGH;
    }
    else if(strValue.equalsIgnoreCase("LOW")){
        value = LOW;
    }
    else{
        return -3;
    }

    digitalWrite(pin, value);

    return 1;
}


void setup() {
    Serial.begin(9600);
    dht.begin();
    pinMode(led1, OUTPUT);
    pinMode(led2, OUTPUT);
    pinMode(SENSORPIN, INPUT_PULLUP);
    digitalWrite(SENSORPIN, HIGH);

    Particle.function("gettmp", getTemperature);
    Particle.function("gethmd", getHumidity);
    Particle.function("ctrlled", controlled);

}

void loop() {

    temperature = (int)dht.readTemperature();
    humidity = (int)dht.readHumidity();

    Serial.print("Temperature: ");
    Serial.println(String(temperature)+" Celcius");
    Serial.print("Humidity: ");
    Serial.print(String(humidity)+" Percent");
    Serial.println();
    Serial.println("------------");

    delay(1000);


}
