'use strict';

const { Driver } = require('homey');
const Connection = require('../../lib/rctjavalib/connection.js');
const { Identifier } = require('../../lib/rctjavalib/datagram.js');

class MyDriver extends Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MyDriver has been initialized');
    this._socChangedTrigger = this.homey.flow.getDeviceTriggerCard("the-soc-has-changed");
  }
  
  triggerSOCChanged(device, tokens, state) {
    this._socChangedTrigger
      .trigger(device, tokens, state)
      .then(this.log)
      .catch(this.error);
  }
  

  /**
   * onPairListDevices is called when a user is adding a device
   * and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  /*
  async onPairListDevices() {
    return [
      // Example device data, note that `store` is optional
       {
         name: 'My Device',
         data: {
           id: 'my-device-001',
         },
         store: {
           address: '192.168.0.211',
         },
       },
    ];
  } */

  onPair(session) {
    var devices = [];
    // session is a direct channel to the front-end
    // see https://apps.developer.athom.com/tutorial-AppFrontend.html
    session.setHandler('validate', async function (data) {
      console.log("Validate new connection settings");

      // Test connection
      const connection = new Connection(data.host, data.port, 5000);
      try {
          await connection.connect();
          console.log('Connction successful');

          // Get inverter SN and build device list
          let strInverterSN = await connection.queryString(Identifier.INVERTER_SN);
          strInverterSN = strInverterSN.replace(/\x00/g, '');  // Entfernen Sie alle \x00 Zeichen
          console.log('Inverter SN: ', strInverterSN);
          const ip = data.host;
          const device = {
              name: 'RCT Power Storage DC',
              data: {
                  id: strInverterSN
              },
              store: {
                  address: ip,
                  port: data.port
              },
          };
          console.log(device);
          devices.push(device);
          connection.close();
          return 'ok';

      } catch (error) {
          console.error('Connection unsuccessful:', error);
          return error;
      } 

    });

      session.setHandler('list_devices', async function (data) {
        console.log('List devices started...');

        return devices;
    });

  }
  
}

module.exports = MyDriver;
