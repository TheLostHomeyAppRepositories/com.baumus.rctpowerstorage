'use strict';

const { Driver } = require('homey');
const Connection = require('../../lib/rctjavalib/connection');
const { Identifier } = require('../../lib/rctjavalib/datagram');

class MyDriver extends Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MyDriver has been initialized');
    this._socChangedTrigger = this.homey.flow.getDeviceTriggerCard('the-soc-has-changed');

    // Register the solar-power-greater-than condition card
    this.homey.flow.getConditionCard('solar-power-greater-than')
      .registerRunListener((args, state) => {
        return args.device.getCapabilityValue('solar_power') > args.Watt;
      });

    // Register the battery-level-greater-than condition card
    this.homey.flow.getConditionCard('battery-level-greater-than')
      .registerRunListener((args, state) => {
        return args.device.getCapabilityValue('measure_battery') > args.SOC;
      });

    // Register the inverter-power-greater-than condition card
    this.homey.flow.getConditionCard('inverter-power-greater-than')
      .registerRunListener((args, state) => {
        return args.device.getCapabilityValue('measure_power') > args.Watt;
      });

    // Register the total-grid-power-greater-than condition card
    this.homey.flow.getConditionCard('total-grid-power-greater-than')
      .registerRunListener((args, state) => {
        return args.device.getCapabilityValue('measure_power') > args.Watt;
      });

    // Register the load-household-greater-than condition card
    this.homey.flow.getConditionCard('load-household-greater-than')
      .registerRunListener((args, state) => {
        return args.device.getCapabilityValue('measure_power') > args.Watt;
      });

    // Register the soc_strategy_is condition card
    this.homey.flow.getConditionCard('soc_strategy_is')
      .registerRunListener((args, state) => {
        return args.device.getCapabilityValue('soc_strategy') === args.soc_strategy;
      });

    // Regsiter the disable_battery_discharge action card
    this.homey.flow.getActionCard('disable_battery_discharge')
      .registerRunListener(async (args) => {
        await args.device.disableBatteryDischarge();
      });

    // Register the enable_default_operating_mode action card
    this.homey.flow.getActionCard('enable_default_operating_mode')
      .registerRunListener(async (args) => {
        await args.device.enableDefaultOperatingMode();
      });

    // Register the enable_grid_charging action card
    this.homey.flow.getActionCard('enable_grid_charging')
      .registerRunListener(async (args) => {
        await args.device.enableGridCharging();
      });
  }

  triggerSOCChanged(device, tokens, state) {
    this._socChangedTrigger
      .trigger(device, tokens, state)
      .then(this.log)
      .catch(this.error);
  }

  onPair(session) {
    const devices = [];
    session.setHandler('validate', async (data) => {
      this.log('Validate new connection settings');

      const connection = new Connection(data.host, data.port, 5000);
      try {
        await connection.connect();
        this.log('Connection successful');

        let strInverterSN = await connection.queryString(Identifier.INVERTER_SN);
        strInverterSN = strInverterSN.split('\x00').join('');
        this.log('Inverter SN: ', strInverterSN);

        const device = {
          name: 'RCT Power Storage DC',
          data: {
            id: strInverterSN,
          },
          store: {
            address: data.host,
            port: data.port,
          },
        };
        this.log(device);
        devices.push(device);
        return 'ok';
      } catch (error) {
        this.error('Connection unsuccessful:', error);
        return error;
      } finally {
        connection.close();
      }
    });

    session.setHandler('list_devices', async () => {
      this.log('List devices started...');
      return devices;
    });
  }

}

module.exports = MyDriver;
