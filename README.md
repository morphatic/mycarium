# The Mycarium Project

A few years ago I became interested in growing mushrooms. The tutorials I read indicated that maintaining the temperature and humidity of the mushrooms between a fairly narrow range was key to success. I began dreaming of building my own mycological terrarium or "mycarium" as I've taken to calling it. This repo contains all of the code related to that effort.

If you'd like to use it yourself, here's how it's organized:

* [**3d**](3d/)<br>
  This folder contains the 3D models that I created in Fusion 360 that I then printed out to build the actual chamber and housing for the various electronics that I used.
* [**esp32**](esp32/)<br>
  This folder contains the code you'll need to setup and ESP32-controlled electronics needed to maintain and control the temperature and humidity within the mycarium. It also has instructions for how to setup and configure a server to host your MQTT broker that will mediate communication between the mycarium controller and the app.
* [**app**](app/)<br>
  This is the code for the mobile app that I built to monitor and control the mycarium.
