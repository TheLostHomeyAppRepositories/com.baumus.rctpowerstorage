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

    // Register the solar-power-greater-than condition card
    this.homey.flow.getConditionCard("solar-power-greater-than")
      .registerRunListener((args, state) => {
        return args.device.getCapabilityValue("solar_power") > args.Watt;
      });

    // Register the battery-level-greater-than condition card
    this.homey.flow.getConditionCard("battery-level-greater-than")
      .registerRunListener((args, state) => {
        return args.device.getCapabilityValue("measure_battery") > args.SOC;
      });

  }
  
  triggerSOCChanged(device, tokens, state) {
    this._socChangedTrigger
      .trigger(device, tokens, state)
      .then(this.log)
      .catch(this.error);
  }
  
  onPair(session) {
    let devices = [];
    session.setHandler('validate', async (data) => {
      console.log("Validate new connection settings");

      const connection = new Connection(data.host, data.port, 5000);
      try {
        await connection.connect();
        console.log('Connection successful');

        let strInverterSN = await connection.queryString(Identifier.INVERTER_SN);
        strInverterSN = strInverterSN.replace(/\x00/g, '');
        console.log('Inverter SN: ', strInverterSN);

        const device = {
          name: 'RCT Power Storage DC',
          data: {
            id: strInverterSN
          },
          store: {
            address: data.host,
            port: data.port
          },
        };
        console.log(device);
        devices.push(device);
        return 'ok';

      } catch (error) {
        console.error('Connection unsuccessful:', error);
        return error;
      } finally {
        connection.close();
      }
    });

    session.setHandler('list_devices', async () => {
      console.log('List devices started...');
      return devices;
    });
  }
}

module.exports = MyDriver;
