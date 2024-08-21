'use strict';

const { Device } = require('homey');
const Connection = require('../../lib/rctjavalib/connection.js');
const { Identifier } = require('../../lib/rctjavalib/datagram.js');

class MyDevice extends Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('MyDevice has been initialized');
    this.setAvailable();

    // Error handling for connection errors
    try {
      // Establish a connection
      const conn = new Connection(this.getStoreValue('address'), this.getStoreValue('port'), 5000);
      await conn.connect();

      // Query the Battery Capacity and Module Health (only during initialization)
      const bcapacity = await conn.queryFloat32(Identifier.BATTERY_CAPACITY_AH);
      const bvoltage = await conn.queryFloat32(Identifier.BATTERY_VOLTAGE);
      const roundedCapacity = (Math.round(bcapacity * bvoltage / 1000 * 10) / 10).toFixed(1);

      const batteryModules = [
        { serial: Identifier.BATTERY_MODULE_0_SERIAL, umax: Identifier.BATTERY_MODULE_0_UMAX, umin: Identifier.BATTERY_MODULE_0_UMIN },
        { serial: Identifier.BATTERY_MODULE_1_SERIAL, umax: Identifier.BATTERY_MODULE_1_UMAX, umin: Identifier.BATTERY_MODULE_1_UMIN },
        { serial: Identifier.BATTERY_MODULE_2_SERIAL, umax: Identifier.BATTERY_MODULE_2_UMAX, umin: Identifier.BATTERY_MODULE_2_UMIN },
        { serial: Identifier.BATTERY_MODULE_3_SERIAL, umax: Identifier.BATTERY_MODULE_3_UMAX, umin: Identifier.BATTERY_MODULE_3_UMIN },
        { serial: Identifier.BATTERY_MODULE_4_SERIAL, umax: Identifier.BATTERY_MODULE_4_UMAX, umin: Identifier.BATTERY_MODULE_4_UMIN },
        { serial: Identifier.BATTERY_MODULE_5_SERIAL, umax: Identifier.BATTERY_MODULE_5_UMAX, umin: Identifier.BATTERY_MODULE_5_UMIN },
        { serial: Identifier.BATTERY_MODULE_6_SERIAL, umax: Identifier.BATTERY_MODULE_6_UMAX, umin: Identifier.BATTERY_MODULE_6_UMIN }
      ];

      const settings = {
        DeviceId: this.getData().id,
        DeviceIP: this.getStoreValue('address'),
        DevicePort: this.getStoreValue('port'),
        battery_capacity: roundedCapacity.toString()
      };

      for (let i = 0; i < batteryModules.length; i++) {
        const serial = await conn.queryString(batteryModules[i].serial);
        const umax = await conn.queryFloat32(batteryModules[i].umax);
        const umin = await conn.queryFloat32(batteryModules[i].umin);
        settings[`battery_module_${i}_serial`] = serial;
        settings[`battery_module_${i}_health`] = (serial === '') ? '' : (umax < 3.500 && umin >= 3.000) ? 'good' : 'bad';
      }

      await this.setSettings(settings);

      // Close the connection when done
      conn.close();

    } catch (error) {
      this.log('Error during initialization:', error);

      // Specific handling for EHOSTUNREACH error
      if (error.code === 'EHOSTUNREACH') {
          this.setUnavailable(`The target device ${this.getStoreValue('address')}:${this.getStoreValue('port')} is unreachable.`);
      } else {
          // Handle other errors or set as unavailable
          this.setUnavailable('Device is currently unavailable due to an error.');
      }
    }

    // Polling for regular updates
    this.pollingInterval = setInterval(() => {
      this.updateDeviceData();
    }, this.getSetting('polling_interval') * 1000);
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MyDevice has been deleted');
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  /**
   * updateDeviceData handles regular updates to device capabilities.
   */
  async updateDeviceData() {
    let conn;

    try {
      // Establish a connection
      conn = new Connection(this.getStoreValue('address'), this.getStoreValue('port'), 5000);
      await conn.connect();

      // Query and update regularly changing data
      const power = await conn.queryFloat32(Identifier.INVERTER_AC_POWER_W);
      this.setCapabilityValue('measure_power', Math.round(power));
      
      const battery = await conn.queryFloat32(Identifier.BATTERY_SOC);
      this.setCapMeasureBattery(Math.round(battery * 100));

      const tgridpower = await conn.queryFloat32(Identifier.TOTAL_GRID_POWER_W);
      this.setCapabilityValue('total_grid_power', Math.round(tgridpower));

      const loadhousehold = await conn.queryFloat32(Identifier.LOAD_HOUSEHOLD_POWER_W);
      this.setCapabilityValue('load_household', Math.round(loadhousehold));

      const batterypower = await conn.queryFloat32(Identifier.BATTERY_POWER_W);
      this.setCapabilityValue('battery_power', Math.round(batterypower) * -1);

      if (batterypower < 0) {
        this.setCapabilityValue('battery_modus', 'charge');
      } else if (batterypower > 0) {
        this.setCapabilityValue('battery_modus', 'discharge');
      } else {
        this.setCapabilityValue('battery_modus', 'idle');
      }

      const solarpowera = await conn.queryFloat32(Identifier.SOLAR_GEN_A_POWER_W);
      const solarpowerb = await conn.queryFloat32(Identifier.SOLAR_GEN_B_POWER_W);
      const solarpower = solarpowera + solarpowerb;
      this.setCapabilityValue('solar_power', Math.round(solarpower));

      // Set the device as available
      this.setAvailable();

    } catch (error) {
      this.log('Error updating device:', error);

      // Specific handling for EHOSTUNREACH error
      if (error.code === 'EHOSTUNREACH') {
          this.setUnavailable(`The target device ${this.getStoreValue('address')}:${this.getStoreValue('port')} is unreachable.`);
      } else {
          this.setUnavailable('Device is currently unavailable due to an error.');
      }

    } finally {
      if (conn) {
        conn.close();
      }
    }
  }

  // Check if SOC has changed and set the new value triggering the flow card "The SOC has changed"
  async setCapMeasureBattery(value) {
    if (this.getCapabilityValue('measure_battery') !== value) {
      await this.setCapabilityValue('measure_battery', value);
      this.triggerSOCHasChanged(value);
    }
  }

  // Trigger the flow card "The SOC has changed"
  triggerSOCHasChanged(value) {
    const tokens = { soc: value };
    const state = {};

    this.driver.ready().then(() => {
      this.driver.triggerSOCChanged(this, tokens, state);
    });
  }
}

module.exports = MyDevice;
